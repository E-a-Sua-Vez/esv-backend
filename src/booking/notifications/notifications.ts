import { htmlTemplate as TERMS_AND_CONDITIONS_ES } from '../templates/terms_and_conditions_es';
import { htmlTemplate as TERMS_AND_CONDITIONS_PT } from '../templates/terms_and_conditions_pt';

export const getBookingMessage = (country, bookingCommerce, booking, bookingDate, link, linkWs) => {
  // Check if it's a telemedicine booking
  const isTelemedicine = booking.type === 'TELEMEDICINE' || booking.telemedicineConfig;
  const telemedicineType =
    booking.telemedicineConfig?.type === 'VIDEO'
      ? 'Video'
      : booking.telemedicineConfig?.type === 'CHAT'
      ? 'Chat'
      : booking.telemedicineConfig?.type === 'BOTH'
      ? 'Video y Chat'
      : '';

  const telemedicineInfo = isTelemedicine
    ? `\n\n💻 *Consulta por Teleconsulta*\n📋 Tipo: ${telemedicineType}${
        booking.telemedicineConfig?.scheduledAt
          ? `\n📅 Fecha y Hora: ${new Date(booking.telemedicineConfig.scheduledAt).toLocaleString()}`
          : ''
      }`
    : '';

  const BOOKING = {
    pt: `✅ *Reserva confirmada!*

🎉 Sua reserva em *${bookingCommerce.name}* foi realizada com sucesso!${
      isTelemedicine
        ? ' 💻 Esta é uma consulta por teleconsulta.'
        : ` 📅 Você deve vir no dia *${bookingDate}*${
            booking.block && booking.block.hourFrom ? ` às *${booking.block.hourFrom}*.` : `.`
          }`
    }${telemedicineInfo}

🎫 *Seu número de reserva:* ${booking.number}

🔗 *Para detalhes ou cancelamento:*
${link}
${
      linkWs !== undefined
        ? `
💬 *Dúvidas? Entre em contato:*
${linkWs}
`
        : ``
    }
🤝 *Obrigado pela preferência!* 🙏`,
    es: `✅ *¡Reserva confirmada!*

🎉 Tu reserva en *${bookingCommerce.name}* fue generada con éxito!${
      isTelemedicine
        ? ' 💻 Esta es una consulta por teleconsulta.'
        : ` 📅 Debes venir el día *${bookingDate}*${
            booking.block && booking.block.hourFrom ? ` a las *${booking.block.hourFrom}*.` : `.`
          }`
    }${telemedicineInfo}

🎫 *Tu número de reserva:* ${booking.number}

🔗 *Para detalles o cancelar:*
${link}
${
      linkWs !== undefined
        ? `
💬 *¿Dudas? Contáctanos:*
${linkWs}
`
        : ``
    }
🤝 *¡Gracias por elegirnos!* 🙏`,
  };
  return BOOKING[country];
};

export const getBookingConfirmMessage = (country, bookingCommerce, booking, bookingDate, link) => {
  // Check if it's a telemedicine booking
  const isTelemedicine = booking.type === 'TELEMEDICINE' || booking.telemedicineConfig;
  const telemedicineType =
    booking.telemedicineConfig?.type === 'VIDEO'
      ? 'Video'
      : booking.telemedicineConfig?.type === 'CHAT'
      ? 'Chat'
      : booking.telemedicineConfig?.type === 'BOTH'
      ? 'Video y Chat'
      : '';

  const telemedicineInfo = isTelemedicine
    ? `\n\n💻 *Consulta por Teleconsulta*\n📋 Tipo: ${telemedicineType}${
        booking.telemedicineConfig?.scheduledAt
          ? `\n📅 Fecha y Hora: ${new Date(booking.telemedicineConfig.scheduledAt).toLocaleString()}`
          : ''
      }`
    : '';

  const BOOKING_CONFIRM = {
    pt: `📢 *Lembrete de reserva*

⏰ Lembre-se da sua reserva em *${bookingCommerce.name}*!${
      isTelemedicine
        ? ' 💻 Esta é uma consulta por teleconsulta.'
        : ` 📅 Você deve vir no dia *${bookingDate}*${
            booking.block && booking.block.hourFrom ? ` às *${booking.block.hourFrom}*.` : `.`
          }`
    }${telemedicineInfo}

🎫 *Seu número de reserva:* ${booking.number}

❓ *Poderá comparecer?*

❌ Se sua resposta for *NÃO*, por favor cancele sua reserva:
${link}

🤝 *Obrigado!* 🙏`,
    es: `📢 *Recordatorio de reserva*

⏰ Recuerda tu reserva en *${bookingCommerce.name}*!${
      isTelemedicine
        ? ' 💻 Esta es una consulta por teleconsulta.'
        : ` 📅 Debes venir el día *${bookingDate}*${
            booking.block && booking.block.hourFrom ? ` a las *${booking.block.hourFrom}*.` : `.`
          }`
    }${telemedicineInfo}

🎫 *Tu número de reserva:* ${booking.number}

❓ *¿Podrás asistir?*

❌ Si tu respuesta es *NO*, por favor cancela tu reserva:
${link}

🤝 *¡Gracias!* 🙏`,
  };
  return BOOKING_CONFIRM[country];
};

export const getBookingCancelledMessage = (country, bookingCommerce, bookingDate, link) => {
  const BOOKING_CANCELLED = {
    pt: `⚠️ *Reserva cancelada*

❌ Sua reserva em *${bookingCommerce.name}* para o dia *${bookingDate}* foi cancelada.

📅 *Para reservar novamente:*
${link}

🤝 *Obrigado!* 🙏`,
    es: `⚠️ *Reserva cancelada*

❌ Tu reserva en *${bookingCommerce.name}* del día *${bookingDate}* fue cancelada.

📅 *Para reservar nuevamente:*
${link}

🤝 *¡Gracias!* 🙏`,
  };
  return BOOKING_CANCELLED[country];
};

export const getBookingCommerceConditions = (country, bookingCommerce) => {
  const BOOKING_COMMERCE_CONDITIONS = {
    pt: {
      subject: `Termos e Condições de ${bookingCommerce.name}`,
      html: TERMS_AND_CONDITIONS_PT,
    },
    es: {
      subject: `Terminos y Condiciones de ${bookingCommerce.name}`,
      html: TERMS_AND_CONDITIONS_ES,
    },
  };
  return BOOKING_COMMERCE_CONDITIONS[country];
};
