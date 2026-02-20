import { Readable } from 'stream';

import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
const PDFDocument = require('pdfkit');

import { ProfessionalCommissionPayment } from './model/professional-commission-payment.entity';
import { ProfessionalCommissionPaymentService } from './professional-commission-payment.service';
import { ProfessionalService } from '../professional/professional.service';
import { CommerceService } from '../commerce/commerce.service';
import { IncomeService } from '../income/income.service';
import { ClientService } from '../client/client.service';
import { Laguage } from '../shared/model/language.enum';

@Injectable()
export class ProfessionalCommissionPaymentPdfService {
  private s3: AWS.S3;
  private readonly logger = new Logger(ProfessionalCommissionPaymentPdfService.name);

  constructor(
    private commissionPaymentService: ProfessionalCommissionPaymentService,
    private professionalService: ProfessionalService,
    private commerceService: CommerceService,
    private incomeService: IncomeService,
    private clientService: ClientService
  ) {
    this.s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region: process.env.AWS_DEFAULT_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  /**
   * Obtener traducciones según el idioma
   */
  private getTranslations(language: string | Laguage = 'es') {
    const translations: any = {
      es: {
        title: 'Comprobante de Pago de Comisiones',
        professional: 'Profesional:',
        paymentInfo: 'Información del Pago:',
        status: 'Estado:',
        period: 'Período:',
        creationDate: 'Fecha de Creación:',
        paymentDate: 'Fecha de Pago:',
        paymentMethod: 'Método de Pago:',
        cancellationDate: 'Fecha de Cancelación:',
        reason: 'Razón:',
        financialSummary: 'Resumen Financiero:',
        totalIncomes: 'Total de Receitas:',
        totalAmount: 'Valor Total:',
        totalCommission: 'Comisión Total:',
        notes: 'Notas:',
        includedIncomes: 'Receitas Incluídas:',
        date: 'Fecha',
        type: 'Tipo',
        client: 'Cliente',
        value: 'Valor',
        commission: 'Comisión',
        total: 'Total:',
        statusCreated: 'Creado',
        statusPaid: 'Pagado',
        statusCancelled: 'Cancelado',
        phone: 'Tel:',
        email: 'Email:',
        address: 'Dirección:',
        generatedOn: 'Generado el:',
        documentGenerated: 'Documento generado automáticamente',
        page: 'Página',
        of: 'de',
      },
      pt: {
        title: 'Comprovante de Pagamento de Comissões',
        professional: 'Profissional:',
        paymentInfo: 'Informação do Pagamento:',
        status: 'Estado:',
        period: 'Período:',
        creationDate: 'Data de Criação:',
        paymentDate: 'Data de Pagamento:',
        paymentMethod: 'Método de Pagamento:',
        cancellationDate: 'Data de Cancelamento:',
        reason: 'Razão:',
        financialSummary: 'Resumo Financeiro:',
        totalIncomes: 'Total de Receitas:',
        totalAmount: 'Valor Total:',
        totalCommission: 'Comissão Total:',
        notes: 'Notas:',
        includedIncomes: 'Receitas Incluídas:',
        date: 'Data',
        type: 'Tipo',
        client: 'Cliente',
        value: 'Valor',
        commission: 'Comissão',
        total: 'Total:',
        statusCreated: 'Criado',
        statusPaid: 'Pago',
        statusCancelled: 'Cancelado',
        phone: 'Tel:',
        email: 'Email:',
        address: 'Endereço:',
        generatedOn: 'Gerado em:',
        documentGenerated: 'Documento gerado automaticamente',
        page: 'Página',
        of: 'de',
      },
      en: {
        title: 'Commission Payment Receipt',
        professional: 'Professional:',
        paymentInfo: 'Payment Information:',
        status: 'Status:',
        period: 'Period:',
        creationDate: 'Creation Date:',
        paymentDate: 'Payment Date:',
        paymentMethod: 'Payment Method:',
        cancellationDate: 'Cancellation Date:',
        reason: 'Reason:',
        financialSummary: 'Financial Summary:',
        totalIncomes: 'Total Incomes:',
        totalAmount: 'Total Amount:',
        totalCommission: 'Total Commission:',
        notes: 'Notes:',
        includedIncomes: 'Included Incomes:',
        date: 'Date',
        type: 'Type',
        client: 'Client',
        value: 'Value',
        commission: 'Commission',
        total: 'Total:',
        statusCreated: 'Created',
        statusPaid: 'Paid',
        statusCancelled: 'Cancelled',
        phone: 'Phone:',
        email: 'Email:',
        address: 'Address:',
        generatedOn: 'Generated on:',
        documentGenerated: 'Document generated automatically',
        page: 'Page',
        of: 'of',
      },
    };
    // Normalizar el idioma a string para la búsqueda
    let langKey: string;
    if (typeof language === 'string') {
      langKey = language;
    } else if (language && typeof language === 'object' && 'toString' in language) {
      langKey = String(language);
    } else {
      langKey = 'es'; // Default
    }
    const result = translations[langKey] || translations.es;
    this.logger.debug(`Translation lookup: language=${langKey}, found=${!!translations[langKey]}`);
    return result;
  }

  /**
   * Obtener nombre del cliente
   */
  private async getClientName(clientId: string): Promise<string> {
    if (!clientId) {
      this.logger.warn('getClientName called with empty clientId');
      return '-';
    }
    try {
      const client = await this.clientService.getClientById(clientId);
      if (client) {
        const fullName = [client.name, client.lastName].filter(Boolean).join(' ');
        const result = fullName || client.idNumber || clientId;
        this.logger.debug(`Client name resolved: ${result} for clientId: ${clientId}`);
        return result;
      } else {
        this.logger.warn(`Client not found for clientId: ${clientId}`);
        return clientId;
      }
    } catch (error) {
      this.logger.error(`Could not fetch client ${clientId}: ${error.message}`);
      return clientId;
    }
  }

  /**
   * Generar PDF de pago de comisiones
   */
  async generateCommissionPaymentPdf(
    paymentId: string,
    commerceId: string
  ): Promise<{ pdfUrl: string; verificationUrl: string }> {
    try {
      // Obtener datos del pago
      const payment = await this.commissionPaymentService.getCommissionPaymentById(paymentId);
      if (!payment) {
        throw new HttpException('Commission payment not found', HttpStatus.NOT_FOUND);
      }

      // Obtener datos del profesional
      let professional;
      try {
        professional = await this.professionalService.getProfessionalById(
          payment.professionalId
        );
      } catch (error) {
        this.logger.warn(`Could not fetch professional ${payment.professionalId}: ${error.message}`);
        professional = null;
      }
      const professionalName =
        professional?.personalInfo?.name || professional?.name || payment.professionalId;

      // Obtener datos del commerce
      let commerce;
      try {
        commerce = await this.commerceService.getCommerceById(commerceId);
      } catch (error) {
        this.logger.warn(`Could not fetch commerce ${commerceId}: ${error.message}`);
        commerce = null;
      }
      const commerceName = commerce?.name || 'Commerce';
      const commerceAddress = commerce?.localeInfo?.address || '';
      const commercePhone = commerce?.phone || commerce?.contactInfo?.phone || '';
      const commerceEmail = commerce?.email || commerce?.contactInfo?.email || '';
      const commerceLogo = commerce?.logo || '';

      // Obtener idioma del commerce o business (default: español)
      // El idioma puede venir como string o como enum, normalizarlo
      let language = commerce?.localeInfo?.language || Laguage.es;
      // Si viene como string, convertirlo al enum
      if (typeof language === 'string') {
        language = language.toLowerCase() as Laguage;
      }
      // Asegurarse de que sea un valor válido del enum
      if (!Object.values(Laguage).includes(language)) {
        this.logger.warn(`Invalid language ${language}, defaulting to Spanish`);
        language = Laguage.es;
      }
      this.logger.debug(`Using language: ${language} for commerce ${commerceId}`);
      const t = this.getTranslations(language);

      // Obtener detalles de las receitas incluidas con información del cliente
      const incomeDetails: any[] = [];
      if (payment.incomeIds && payment.incomeIds.length > 0) {
        for (const incomeId of payment.incomeIds) {
          try {
            const income = await this.incomeService.getIncomeById(incomeId);
            if (income) {
              // Crear un nuevo objeto con todas las propiedades del income
              const incomeWithClient: any = Object.assign({}, income);

              // Obtener nombre del cliente
              if (income.clientId) {
                try {
                  const clientName = await this.getClientName(income.clientId);
                  // Asegurarse de que clientName sea un string válido
                  if (clientName && typeof clientName === 'string' && clientName !== '[object Object]') {
                    incomeWithClient.clientName = clientName;
                    this.logger.debug(`Client name for income ${incomeId}: ${clientName}`);
                  } else {
                    this.logger.warn(`Invalid clientName returned for income ${incomeId}: ${clientName}, using clientId`);
                    incomeWithClient.clientName = income.clientId;
                  }
                } catch (clientError) {
                  this.logger.error(`Error getting client name for income ${incomeId}: ${clientError.message}`);
                  incomeWithClient.clientName = income.clientId || '-';
                }
              } else {
                incomeWithClient.clientName = '-';
                this.logger.warn(`No clientId found for income ${incomeId}`);
              }

              // Asegurarse de que clientName no sea undefined
              if (!incomeWithClient.clientName) {
                incomeWithClient.clientName = income.clientId || '-';
              }

              incomeDetails.push(incomeWithClient);
            }
          } catch (error) {
            this.logger.warn(`Could not fetch income ${incomeId}: ${error.message}`);
          }
        }
      }

      // Crear documento PDF con márgenes ajustados para header y footer
      // Calcular altura del header dinámicamente
      let headerHeight = 30; // Título
      headerHeight += 15; // Nombre del commerce
      if (commerceAddress) headerHeight += 10;
      if (commercePhone) headerHeight += 10;
      if (commerceEmail) headerHeight += 10;
      headerHeight += 10; // Línea separadora y espacio

      const topMargin = Math.max(headerHeight + 20, 100); // Espacio para header completo + margen
      const bottomMargin = 60; // Espacio para footer (ajustado para evitar salto de página)
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: topMargin, bottom: bottomMargin, left: 50, right: 50 },
        layout: 'portrait',
      });

      // Contador de páginas
      let pageCount = 1; // Empezar en 1 porque ya tenemos la primera página

      // Determinar locale para formateo según idioma
      const localeMap: any = {
        [Laguage.pt]: 'pt-BR',
        [Laguage.es]: 'es-ES',
        [Laguage.en]: 'en-US',
      };
      const locale = localeMap[language] || 'es-ES';

      // Fecha y hora de generación
      const generationDate = new Date();
      const formatDateTime = (date: Date) => {
        return new Date(date).toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      };

      // Funciones para agregar header y footer en cada página
      const addHeader = () => {
        try {
          const pageWidth = doc.page.width;
          let headerY = 30;

          // Título
          doc.fontSize(14).font('Helvetica-Bold').text(t.title, 50, headerY, {
            align: 'center',
            width: pageWidth - 100,
          });
          headerY += 15;

          // Nombre del Commerce
          doc.fontSize(10).font('Helvetica-Bold').text(commerceName, 50, headerY, {
            width: pageWidth - 100,
          });
          headerY += 12;

          // Dirección del Commerce
          if (commerceAddress) {
            doc.fontSize(8).font('Helvetica').text(`${t.address} ${commerceAddress}`, 50, headerY, {
              width: pageWidth - 100,
            });
            headerY += 10;
          }

          // Teléfono del Commerce
          if (commercePhone) {
            doc.fontSize(8).font('Helvetica').text(`${t.phone} ${commercePhone}`, 50, headerY, {
              width: pageWidth - 100,
            });
            headerY += 10;
          }

          // Email del Commerce
          if (commerceEmail) {
            doc.fontSize(8).font('Helvetica').text(`${t.email} ${commerceEmail}`, 50, headerY, {
              width: pageWidth - 100,
            });
            headerY += 10;
          }

          // Línea separadora
          headerY += 5;
          doc.moveTo(50, headerY).lineTo(pageWidth - 50, headerY).stroke();
        } catch (error) {
          this.logger.warn(`Error adding header: ${error.message}`);
        }
      };

      const addFooter = (currentPage: number, totalPages: number) => {
        try {
          const pageHeight = doc.page.height;
          const pageWidth = doc.page.width;
          // Posicionar el footer justo antes del margen inferior (dentro del área segura)
          const footerY = pageHeight - bottomMargin + 25; // 25px desde el borde inferior

          // Verificar que el footer esté dentro de los límites de la página
          // El footer debe estar entre bottomMargin y pageHeight - 5
          if (footerY >= bottomMargin && footerY <= pageHeight - 5) {
            // Línea separadora del footer (5px antes del texto)
            const lineY = footerY - 5;
            if (lineY > bottomMargin && lineY < pageHeight) {
              doc.moveTo(50, lineY).lineTo(pageWidth - 50, lineY).stroke();
            }

            // Texto del footer con número de página (compacto)
            doc.fontSize(6).font('Helvetica'); // Tamaño más pequeño para evitar salto de página
            const dateText = `${t.generatedOn} ${formatDateTime(generationDate)}`;
            const pageText = `${t.page} ${currentPage} ${t.of} ${totalPages}`;
            const fullText = `${t.documentGenerated} - ${dateText} | ${pageText}`;

            // Usar text con width limitado para que se ajuste automáticamente
            // y no cause salto de página
            doc.text(fullText, 50, footerY, {
              width: pageWidth - 100,
              align: 'center',
              lineGap: 0,
              height: 8, // Limitar altura máxima a 8px
            });
          }
        } catch (error) {
          this.logger.warn(`Error adding footer: ${error.message}`);
        }
      };

      // Agregar header cuando se agrega una nueva página
      // Usar una bandera para evitar bucles infinitos
      let isAddingPage = false;
      doc.on('pageAdded', () => {
        if (isAddingPage) return; // Evitar bucles
        isAddingPage = true;
        try {
          pageCount++;
          addHeader();
        } finally {
          isAddingPage = false;
        }
      });

      // Agregar header en la primera página (ya está en pageCount = 1)
      addHeader();

      // CONTENIDO PRINCIPAL (empezar después del header)
      let yPosition = topMargin + 10; // Pequeño espacio después del header

      // El header ya fue agregado arriba, no duplicar información del commerce
      // Continuar directamente con el contenido principal

      // Información del Profesional
      doc.fontSize(14).font('Helvetica-Bold').text(t.professional, 50, yPosition);
      yPosition += 18;
      doc.fontSize(12).font('Helvetica').text(professionalName, 50, yPosition);
      yPosition += 25;

      // Información del Pago
      doc.fontSize(12).font('Helvetica-Bold').text(t.paymentInfo, 50, yPosition);
      yPosition += 18;

      const formatDate = (date: Date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'BRL',
        }).format(value || 0);
      };

      // Estado
      const statusText =
        payment.status === 'CREATED'
          ? t.statusCreated
          : payment.status === 'PAID'
            ? t.statusPaid
            : payment.status === 'CANCELLED'
              ? t.statusCancelled
              : payment.status;
      doc.fontSize(10)
        .font('Helvetica')
        .text(`${t.status} ${statusText}`, 50, yPosition);
      yPosition += 15;

      // Período
      doc.fontSize(10)
        .font('Helvetica')
        .text(
          `${t.period} ${formatDate(payment.periodFrom)} - ${formatDate(payment.periodTo)}`,
          50,
          yPosition
        );
      yPosition += 15;

      // Fecha de creación
      doc.fontSize(10)
        .font('Helvetica')
        .text(`${t.creationDate} ${formatDate(payment.createdAt)}`, 50, yPosition);
      yPosition += 15;

      // Si está pagado, mostrar información de pago
      if (payment.status === 'PAID' && payment.paidAt) {
        yPosition += 10;
        doc.fontSize(10)
          .font('Helvetica')
          .text(`${t.paymentDate} ${formatDate(payment.paidAt)}`, 50, yPosition);
        yPosition += 15;
        if (payment.paymentMethod) {
          doc.fontSize(10)
            .font('Helvetica')
            .text(`${t.paymentMethod} ${payment.paymentMethod}`, 50, yPosition);
          yPosition += 15;
        }
      }

      // Si está cancelado, mostrar razón
      if (payment.status === 'CANCELLED' && payment.cancelledAt) {
        yPosition += 10;
        doc.fontSize(10)
          .font('Helvetica')
          .text(`${t.cancellationDate} ${formatDate(payment.cancelledAt)}`, 50, yPosition);
        yPosition += 15;
        if (payment.cancellationReason) {
          doc.fontSize(10)
            .font('Helvetica')
            .text(`${t.reason} ${payment.cancellationReason}`, 50, yPosition);
          yPosition += 15;
        }
      }

      yPosition += 10;

      // Resumen Financiero
      doc.fontSize(12).font('Helvetica-Bold').text(t.financialSummary, 50, yPosition);
      yPosition += 18;

      doc.fontSize(10)
        .font('Helvetica')
        .text(`${t.totalIncomes} ${payment.totalIncomes || 0}`, 50, yPosition);
      yPosition += 15;

      doc.fontSize(10)
        .font('Helvetica')
        .text(`${t.totalAmount} ${formatCurrency(payment.totalAmount || 0)}`, 50, yPosition);
      yPosition += 15;

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(`${t.totalCommission} ${formatCurrency(payment.totalCommission || 0)}`, 50, yPosition);
      yPosition += 25;

      // Notas
      if (payment.notes) {
        doc.fontSize(10).font('Helvetica-Bold').text(t.notes, 50, yPosition);
        yPosition += 15;
        doc.fontSize(10)
          .font('Helvetica')
          .text(payment.notes, 50, yPosition, { width: 495, align: 'left' });
        yPosition += 30;
      }

      // Detalles de Receitas Incluidas
      if (incomeDetails.length > 0) {
        yPosition += 10;
        doc.fontSize(12).font('Helvetica-Bold').text(t.includedIncomes, 50, yPosition);
        yPosition += 20;

        // Tabla de receitas
        const tableTop = yPosition;
        const itemHeight = 20;
        let currentY = tableTop;

        // Headers
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('#', 50, currentY);
        doc.text(t.date, 80, currentY);
        doc.text(t.type, 150, currentY);
        doc.text(t.client, 220, currentY);
        doc.text(t.value, 380, currentY, { align: 'right' });
        doc.text(t.commission, 480, currentY, { align: 'right' });
        currentY += itemHeight;

        // Línea separadora
        doc.moveTo(50, currentY).lineTo(545, currentY).stroke();
        currentY += 5;

        // Filas de datos
        doc.fontSize(8).font('Helvetica');
        incomeDetails.forEach((income, index) => {
          // Verificar si necesitamos nueva página (dejar espacio para el footer)
          // El footer necesita ~35px, así que verificamos antes de llegar al límite
          const pageHeight = doc.page.height;
          const maxContentY = pageHeight - bottomMargin - 35; // Dejar 35px para el footer

          if (currentY > maxContentY) {
            // Agregar footer antes de cambiar de página
            // Usar pageCount como estimación del total (se ajustará al final)
            addFooter(pageCount, pageCount);
            doc.addPage();
            currentY = topMargin; // Empezar después del header
          }

          const incomeDate = income.paidAt || income.createdAt;
          const incomeType = income.type || income.typeName || 'N/A';

          // Obtener nombre del cliente - verificar que esté disponible
          let clientName = '-';
          if (income && typeof income === 'object') {
            // Verificar si clientName fue asignado correctamente
            if (income.clientName && typeof income.clientName === 'string' && income.clientName !== '[object Object]') {
              clientName = income.clientName;
            } else if (income.clientId && typeof income.clientId === 'string') {
              // Si no hay clientName válido, usar clientId como fallback
              clientName = income.clientId;
              this.logger.warn(`Using clientId as fallback for income ${income.id || 'unknown'}: ${clientName}`);
            }
          }

          // Validación final - asegurarse de que no sea "[object Object]"
          if (clientName === '[object Object]' || (typeof clientName === 'object' && clientName !== null)) {
            this.logger.error(`Invalid clientName type for income ${income?.id || 'unknown'}: ${typeof clientName}, using '-'`);
            clientName = '-';
          }

          const incomeAmount = income.totalAmount || income.amount || 0;
          const commission = income.professionalCommission || 0;

          doc.text(`${index + 1}`, 50, currentY);
          doc.text(formatDate(incomeDate ? new Date(incomeDate) : null), 80, currentY);
          doc.text(incomeType, 150, currentY, { width: 70 });
          // Usar el nombre del cliente obtenido, truncar si es muy largo
          const displayClientName = clientName.length > 25 ? clientName.substring(0, 22) + '...' : clientName;
          doc.text(displayClientName, 220, currentY, { width: 160 });
          doc.text(formatCurrency(incomeAmount), 380, currentY, { align: 'right', width: 100 });
          doc.text(formatCurrency(commission), 480, currentY, { align: 'right', width: 65 });

          currentY += itemHeight;
        });

        // Línea separadora final
        doc.moveTo(50, currentY).lineTo(545, currentY).stroke();
        currentY += 10;

        // Totales
        doc.fontSize(10).font('Helvetica-Bold');
        const totalAmount = incomeDetails.reduce(
          (sum, inc) => sum + (parseFloat(inc.totalAmount || inc.amount || 0)),
          0
        );
        const totalCommission = incomeDetails.reduce(
          (sum, inc) => sum + (parseFloat(inc.professionalCommission || 0)),
          0
        );

        doc.text(t.total, 350, currentY);
        doc.text(formatCurrency(totalAmount), 380, currentY, { align: 'right', width: 100 });
        doc.text(formatCurrency(totalCommission), 480, currentY, { align: 'right', width: 65 });
      } else {
        // Si no hay detalles, mostrar solo los IDs
        yPosition += 10;
        doc.fontSize(10).font('Helvetica').text('Receitas Incluídas:', 50, yPosition);
        yPosition += 15;
        payment.incomeIds?.forEach((incomeId, index) => {
          doc.fontSize(9)
            .font('Helvetica')
            .text(`${index + 1}. ${incomeId.substring(0, 20)}...`, 50, yPosition);
          yPosition += 12;
        });
      }

      // Agregar footer en la última página antes de finalizar
      // Verificar que haya espacio suficiente (35px para el footer)
      try {
        const pageHeight = doc.page.height;
        // Obtener la posición Y actual del documento
        let currentPageY = doc.y;
        if (!currentPageY || currentPageY === 0) {
          // Si no hay posición Y, usar la última posición conocida
          currentPageY = yPosition || (incomeDetails.length > 0 ? 600 : 500);
        }

        const maxContentY = pageHeight - bottomMargin - 35; // Dejar 35px para el footer

        // Si el contenido está muy abajo, agregar nueva página solo para el footer
        if (currentPageY > maxContentY) {
          // Agregar footer en la página actual antes de cambiar
          addFooter(pageCount, pageCount + 1);
          doc.addPage();
          pageCount++;
        }

        // El total de páginas es el pageCount actual (última página)
        const totalPages = pageCount;

        // Agregar footer en la página actual (última página)
        addFooter(pageCount, totalPages);
      } catch (error) {
        this.logger.warn(`Error adding footer to last page: ${error.message}`);
      }

      // Generar buffer del PDF
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers as Uint8Array[])));
        doc.on('error', reject);

        // Finalizar PDF
        doc.end();
      });

      // Subir a S3 (solo si no existe, para reutilizar el archivo)
      const fileName = `commission-payments/${commerceId}/${paymentId}.pdf`;
      const bucketName = process.env.AWS_S3_COMMERCE_BUCKET || 'ett-commerce-documents';

      // Verificar si el PDF ya existe
      try {
        await this.s3.headObject({
          Bucket: bucketName,
          Key: fileName,
        }).promise();

        // Si existe, no subirlo de nuevo
        this.logger.log(`[PDF] PDF already exists in S3: ${fileName}, skipping upload`);
      } catch (error) {
        // Si no existe, subirlo
        if (error.code === 'NotFound' || error.statusCode === 404) {
          this.logger.log(`[PDF] Uploading new PDF to S3: ${fileName}`);

          const uploadResult = await this.s3
            .upload({
              Bucket: bucketName,
              Key: fileName,
              Body: pdfBuffer,
              ContentType: 'application/pdf',
              Metadata: {
                'generated-at': new Date().toISOString(),
                'payment-id': paymentId,
                'commerce-id': commerceId,
              },
            })
            .promise();

          this.logger.log(`[PDF] Successfully uploaded PDF to S3: ${uploadResult.Location}`);
        } else {
          this.logger.warn(`[PDF] Error checking PDF in S3: ${error.message}`);
          // Intentar subir de todos modos
          const uploadResult = await this.s3
            .upload({
              Bucket: bucketName,
              Key: fileName,
              Body: pdfBuffer,
              ContentType: 'application/pdf',
              Metadata: {
                'generated-at': new Date().toISOString(),
                'payment-id': paymentId,
                'commerce-id': commerceId,
              },
            })
            .promise();

          this.logger.log(`[PDF] Successfully uploaded PDF to S3: ${uploadResult.Location}`);
        }
      }

      // Generar URL firmada (válida por 7 días)
      const signedUrl = this.s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileName,
        Expires: 604800, // 7 días
      });

      // Generar URL de verificación
      const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'https://estuturno.app';
      const verificationUrl = `${baseUrl}/verify/commission-payment/${paymentId}`;

      return {
        pdfUrl: signedUrl,
        verificationUrl,
      };
    } catch (error) {
      this.logger.error(`Error generating commission payment PDF: ${error.message}`, error.stack);
      throw new HttpException(
        `Error generating PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtener PDF de pago de comisiones
   * Genera el PDF solo una vez, luego reutiliza el archivo existente
   */
  async getCommissionPaymentPdf(
    paymentId: string,
    commerceId: string
  ): Promise<Readable> {
    try {
      const fileName = `commission-payments/${commerceId}/${paymentId}.pdf`;
      const bucketName = process.env.AWS_S3_COMMERCE_BUCKET || 'ett-commerce-documents';

      // Verificar si el PDF ya existe en S3
      try {
        const result = await this.s3
          .getObject({
            Bucket: bucketName,
            Key: fileName,
          })
          .promise();

        this.logger.log(`[PDF] PDF found in S3 for payment ${paymentId}, reusing existing file`);
        return Readable.from(result.Body as Buffer);
      } catch (error) {
        // Si el PDF no existe (NoSuchKey, 404, etc.), generarlo
        if (error.code === 'NoSuchKey' || error.statusCode === 404 || error.code === 'NotFound') {
          this.logger.log(`[PDF] PDF not found in S3 for payment ${paymentId}, generating new PDF`);

          // Generar el PDF
          await this.generateCommissionPaymentPdf(paymentId, commerceId);

          // Pequeña espera para asegurar que S3 haya procesado la escritura
          await new Promise(resolve => setTimeout(resolve, 500));

          // Obtener el PDF recién generado desde S3
          const result = await this.s3
            .getObject({
              Bucket: bucketName,
              Key: fileName,
            })
            .promise();

          this.logger.log(`[PDF] Successfully generated and retrieved PDF for payment ${paymentId}`);
          return Readable.from(result.Body as Buffer);
        } else {
          // Otro tipo de error
          this.logger.error(`[PDF] Error checking PDF in S3 for payment ${paymentId}: ${error.message}`);
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(`[PDF] Error getting PDF for payment ${paymentId}: ${error.message}`, error.stack);
      throw new HttpException(
        `Error generating PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generar URL firmada para descargar PDF
   */
  async getCommissionPaymentPdfUrl(
    paymentId: string,
    commerceId: string,
    expiresIn = 3600
  ): Promise<string> {
    try {
      const fileName = `commission-payments/${commerceId}/${paymentId}.pdf`;
      const bucketName = process.env.AWS_S3_COMMERCE_BUCKET || 'ett-commerce-documents';

      return this.s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: fileName,
        Expires: expiresIn,
      });
    } catch (error) {
      throw new HttpException(
        `Error generating PDF URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
