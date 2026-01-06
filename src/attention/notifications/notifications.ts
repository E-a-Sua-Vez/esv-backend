import { htmlTemplate as POST_ATTENTION_ES } from '../templates/post_attention_es';
import { htmlTemplate as POST_ATTENTION_PT } from '../templates/post_attention_pt';

export const getFaltanCincoMessage = (country, attention) => {
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
  return FALTANCINCO[country];
};

export const getFaltaUnoMessage = (country, attention) => {
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
  return FALTAUNO[country];
};

export const getEsTuTunoMessage = (country, attention, moduleNumber, telemedicineInfo = null) => {
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
    return ESTUTURNO_TELEMEDICINE[country];
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
  return ESTUTURNO[country];
};

export const getEncuestaMessage = (country, attention, link) => {
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
  return ENCUESTA[country];
};

export const getAtencionCanceladaMessage = (country, attention, link) => {
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
  return ATTENTION_CANCELLED[country];
};

export const getPostAttetionCommerce = (country, bookingCommerce) => {
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
  return POST_ATTENTION[country];
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
