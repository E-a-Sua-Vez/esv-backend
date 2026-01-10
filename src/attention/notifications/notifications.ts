import { htmlTemplate as POST_ATTENTION_ES } from '../templates/post_attention_es';
import { htmlTemplate as POST_ATTENTION_PT } from '../templates/post_attention_pt';

// Normalize incoming language codes to variants we support in templates
function normalizeCountry(country: string): 'pt' | 'es' {
  if (!country) return 'es';
  const lc = country.toLowerCase();
  if (lc === 'pt' || lc === 'pt-br' || lc === 'br' || lc === 'pt_br') return 'pt';
  if (lc === 'es' || lc === 'es-es' || lc === 'es_es') return 'es';
  return 'es';
}

export const getFaltanCincoMessage = (country, attention) => {
  const variant = normalizeCountry(country);
  const FALTANCINCO = {
    pt: `👋 *Olá!*

⏰ *Quase é a sua vez!*

👥 Restam apenas *5 pessoas* para você ser atendido.

🎫 *Seu número de atendimento:* ${attention.number}

⚡ Por favor, mantenha-se próximo para não perder sua vez.

✅ *Obrigado pela paciência!* 🙏`,
    es: `👋 *¡Hola!*

⏰ *¡Ya casi es tu turno!*

👥 Faltan solo *5 personas* para que seas atendido.

🎫 *Tu número de atención:* ${attention.number}

⚡ Por favor, mantente cerca para no perder tu turno.

✅ *¡Gracias por tu paciencia!* 🙏`,
  };
  return FALTANCINCO[variant];
};

export const getFaltaUnoMessage = (country, attention) => {
  const variant = normalizeCountry(country);
  const FALTAUNO = {
    pt: `👋 *Olá!*

🔥 *Você é o próximo!*

👤 Falta apenas *1 pessoa* para você ser atendido.

🎫 *Seu número de atendimento:* ${attention.number}

🚨 *Prepare-se!* Mantenha-se alerta para quando chamarmos.

⚡ *Quase lá!* 🙏`,
    es: `👋 *¡Hola!*

🔥 *¡Eres el siguiente!*

👤 Falta solo *1 persona* para que seas atendido.

🎫 *Tu número de atención:* ${attention.number}

🚨 *¡Prepárate!* Mantente alerta para cuando te llamemos.

⚡ *¡Ya casi!* 🙏`,
  };
  return FALTAUNO[variant];
};

export const getEsTuTunoMessage = (country, attention, moduleNumber, telemedicineInfo = null) => {
  const variant = normalizeCountry(country);
  // If telemedicine, use different message format
  if (telemedicineInfo) {
    const { accessKey, accessLink, scheduledDate } = telemedicineInfo;
    const ESTUTURNO_TELEMEDICINE = {
      pt: `🎉 *É a sua vez!*

🚨 *AGORA É SEU TURNO!*

💻 *Sua consulta de telemedicina está pronta!*

🎫 *Seu número de atendimento:* ${attention.number}

🔐 *Chave de acesso:* ${accessKey}

🔗 *Link para acessar:* ${accessLink}

${scheduledDate ? `📅 *Data programada:* ${scheduledDate}\n\n` : ''}⚡ Clique no link e insira a chave de acesso para iniciar sua consulta.

✅ *Obrigado!* 🙏`,
      es: `🎉 *¡Es tu turno!*

🚨 *¡AHORA ES TU TURNO!*

💻 *¡Tu consulta de telemedicina está lista!*

🎫 *Tu número de atención:* ${attention.number}

🔐 *Clave de acceso:* ${accessKey}

🔗 *Enlace para acceder:* ${accessLink}

${scheduledDate ? `📅 *Fecha programada:* ${scheduledDate}\n\n` : ''}⚡ Haz clic en el enlace e ingresa la clave de acceso para iniciar tu consulta.

✅ *¡Gracias!* 🙏`,
    };
    return ESTUTURNO_TELEMEDICINE[variant];
  }

  // Standard message with module
  const ESTUTURNO = {
    pt: `🎉 *É a sua vez!*

🚨 *AGORA É SEU TURNO!*

🏃‍♂️ *Dirija-se ao módulo:* ${moduleNumber}

🎫 *Seu número de atendimento:* ${attention.number}

⚡ Por favor, apresente-se imediatamente no módulo indicado.

✅ *Obrigado!* 🙏`,
    es: `🎉 *¡Es tu turno!*

🚨 *¡AHORA ES TU TURNO!*

🏃‍♂️ *Dirígete al módulo:* ${moduleNumber}

🎫 *Tu número de atención:* ${attention.number}

⚡ Por favor, preséntate inmediatamente en el módulo indicado.

✅ *¡Gracias!* 🙏`,
  };
  return ESTUTURNO[variant];
};

export const getEncuestaMessage = (country, attention, link) => {
  const variant = normalizeCountry(country);
  const ENCUESTA = {
    pt: `🙏 *Obrigado!*

✅ Agradecemos por escolher *${attention.commerce.name}*!

📋 *Como foi seu atendimento?*

⭐ Sua opinião é *muito importante* para nós!

🔗 *Avalie-nos aqui (menos de 1 minuto):*
${link}

💬 Se não conseguir acessar o link, responda esta mensagem.

🤝 *Volte sempre!* Estamos aqui para você.`,
    es: `🙏 *¡Gracias!*

✅ Agradecemos por elegir *${attention.commerce.name}*!

📋 *¿Cómo estuvo tu atención?*

⭐ Tu opinión es *muy importante* para nosotros!

🔗 *Califícanos aquí (solo 15 segundos):*
${link}

💬 Si no puedes acceder al link, responde este mensaje.

🤝 *¡Vuelve pronto!* Estamos aquí para ti.`,
  };
  return ENCUESTA[variant];
};

export const getAtencionCanceladaMessage = (country, attention, link) => {
  const variant = normalizeCountry(country);
  const ATTENTION_CANCELLED = {
    pt: `⚠️ *Informação importante*

❌ Seu atendimento em *${attention.commerce.name}* foi *cancelado*.

🔗 *Para agendar novamente:*
${link}

📞 Se tiver dúvidas, entre em contato conosco.

🤝 *Obrigado!* 🙏`,
    es: `⚠️ *Información importante*

❌ Tu atención en *${attention.commerce.name}* fue *cancelada*.

🔗 *Para reservar nuevamente:*
${link}

📞 Si tienes dudas, contáctanos.

🤝 *¡Gracias!* 🙏`,
  };
  return ATTENTION_CANCELLED[variant];
};

export const getAtencionCreadaMessage = (country, attention, link) => {
  const variant = normalizeCountry(country);
  const ATENCION_CREADA = {
    pt: `✅ *Atendimento confirmado!*

🎉 Seu atendimento em *${attention.commerce.name}* foi registrado com sucesso!

🎫 *Seu número de atendimento:* ${attention.number}

📍 *Local:* ${attention.commerce.name}

👥 *Pessoas na frente:* Verifique sua posição na fila no link abaixo

🔗 *Acompanhe seu atendimento:*
${link}

⏰ Recomendamos que chegue com *15 minutos de antecedência*.

📲 Você receberá notificações quando estiver próximo de ser atendido.

🤝 *Obrigado pela preferência!* 🙏`,
    es: `✅ *¡Atención confirmada!*

🎉 Tu atención en *${attention.commerce.name}* fue registrada exitosamente!

🎫 *Tu número de atención:* ${attention.number}

📍 *Lugar:* ${attention.commerce.name}

👥 *Personas delante:* Verifica tu posición en la fila en el enlace

🔗 *Sigue tu atención:*
${link}

⏰ Recomendamos llegar con *15 minutos de anticipación*.

📲 Recibirás notificaciones cuando estés cerca de ser atendido.

🤝 *¡Gracias por elegirnos!* 🙏`,
  };
  return ATENCION_CREADA[variant];
};

export const getPostAttetionCommerce = (country, bookingCommerce) => {
  const variant = normalizeCountry(country);
  const POST_ATTENTION = {
    pt: {
      subject: `Pos Atendimento de ${bookingCommerce.name}`,
      html: POST_ATTENTION_PT,
    },
    es: {
      subject: `Post Atención ${bookingCommerce.name}`,
      html: POST_ATTENTION_ES,
    },
  };
  return POST_ATTENTION[variant];
};

export const getClientPortalAccessMessage = (country, code, portalUrl, commerce) => {
  const CLIENT_PORTAL_ACCESS = {
    pt: `🔐 *Código de Acesso - Portal do Cliente*

📝 *Código:* ${code}

🔗 *Acesso:* ${portalUrl}

🏢 *Estabelecimento:* ${commerce.name}

⏰ *O código expira em 15 minutos*

Insira o código quando solicitado para acessar o portal.`,
    es: `🔐 *Código de Acceso - Portal del Cliente*

📝 *Código:* ${code}

🔗 *Enlace:* ${portalUrl}

🏢 *Comercio:* ${commerce.name}

⏰ *El código expira en 15 minutos*

Ingresa el código cuando se te solicite para acceder al portal.`,
    en: `🔐 *Access Code - Client Portal*

📝 *Code:* ${code}

🔗 *Link:* ${portalUrl}

🏢 *Business:* ${commerce.name}

⏰ *The code expires in 15 minutes*

Enter the code when prompted to access the portal.`
  };
  return CLIENT_PORTAL_ACCESS[country] || CLIENT_PORTAL_ACCESS.en;
};

export const getClientPortalEmailData = (country, commerce) => {
  const CLIENT_PORTAL_EMAIL = {
    pt: {
      subject: `Código de Acesso - Portal do Cliente`,
      greeting: `Olá`,
      title: `Seu código de acesso ao Portal do Cliente é:`,
      accessText: `Acesse:`,
      expirationText: `Este código expira em 15 minutos.`,
      signature: `Atenciosamente`
    },
    es: {
      subject: `Código de Acceso - Portal del Cliente`,
      greeting: `Hola`,
      title: `Tu código de acceso al Portal del Cliente es:`,
      accessText: `Accede en:`,
      expirationText: `Este código expira en 15 minutos.`,
      signature: `Atentamente`
    },
    en: {
      subject: `Access Code - Client Portal`,
      greeting: `Hello`,
      title: `Your access code for the Client Portal is:`,
      accessText: `Access at:`,
      expirationText: `This code expires in 15 minutes.`,
      signature: `Best regards`
    }
  };
  return CLIENT_PORTAL_EMAIL[country] || CLIENT_PORTAL_EMAIL.en;
};

export const getTelemedicineAccessKeyEmail = (country, accessKey, accessLink, scheduledDate) => {
  const variant = normalizeCountry(country);
  const TELEMEDICINE_EMAIL = {
    pt: {
      subject: `Chave de acesso - Consulta de telemedicina`,
      title: `🔐 Chave de acesso para sua consulta de telemedicina`,
      codeLabel: `📋 Código:`,
      linkLabel: `🔗 Link:`,
      dateLabel: `📅 Data programada:`,
      instructionsTitle: `Instruções:`,
      instructions: [
        `Clique no link acima ou copie-o no seu navegador`,
        `Digite o código quando solicitado`,
        `Certifique-se de ter uma boa conexão com a internet`,
        `Tenha sua câmera e microfone prontos para a consulta`
      ],
      footer: `Se tiver problemas para acessar, entre em contato conosco.`
    },
    es: {
      subject: `Clave de acceso - Consulta de telemedicina`,
      title: `🔐 Clave de acceso para tu consulta de telemedicina`,
      codeLabel: `📋 Código:`,
      linkLabel: `🔗 Enlace:`,
      dateLabel: `📅 Fecha programada:`,
      instructionsTitle: `Instrucciones:`,
      instructions: [
        `Haz clic en el enlace de arriba o cópialo en tu navegador`,
        `Ingresa el código cuando se te solicite`,
        `Asegúrate de tener buena conexión a internet`,
        `Ten tu cámara y micrófono listos para la consulta`
      ],
      footer: `Si tienes problemas para acceder, contacta con nosotros.`
    }
  };

  const texts = TELEMEDICINE_EMAIL[variant];
  const instructionsList = texts.instructions.map((instruction, index) =>
    `<li>${instruction}</li>`
  ).join('');

  return {
    subject: texts.subject,
    html: `
      <h2>${texts.title}</h2>

      <p><strong>${texts.codeLabel}</strong> <span style="font-size: 1.2em; font-weight: bold; color: #007bff;">${accessKey}</span></p>

      <p><strong>${texts.linkLabel}</strong> <a href="${accessLink}" target="_blank">${accessLink}</a></p>

      <p><strong>${texts.dateLabel}</strong> ${scheduledDate}</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
        <p><strong>${texts.instructionsTitle}</strong></p>
        <ol>
          ${instructionsList}
        </ol>
      </div>

      <p style="color: #6c757d; font-size: 0.9em;">${texts.footer}</p>
    `
  };
};
