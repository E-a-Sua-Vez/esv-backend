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
    ? `\n\n*Consulta por Telemedicina*\nTipo: ${telemedicineType}${
        booking.telemedicineConfig?.scheduledAt
          ? `\nFecha y Hora: ${new Date(booking.telemedicineConfig.scheduledAt).toLocaleString()}`
          : ''
      }`
    : '';

  const BOOKING = {
    pt: `Olá, sua reserva em *${bookingCommerce.name}* foi feita com sucesso!${
      isTelemedicine
        ? ' Esta é uma consulta por telemedicina.'
        : ` Você deve vir no dia *${bookingDate}* ${
            booking.block && booking.block.hourFrom ? ` as ${booking.block.hourFrom}.` : `.`
          }`
    }${telemedicineInfo}

    Lémbre-se, seu número de reserva é: *${booking.number}*.

    Para detalhes e cancelamentos, acesse o link:

    ${link}
    ${
      linkWs !== undefined
        ? `

    Duvidas? Contate-nos:

    ${linkWs}

    `
        : ``
    }
    Obrigado!`,
    es: `Hola, tu reserva en *${bookingCommerce.name}* fue generada con éxito.${
      isTelemedicine
        ? ' Esta es una consulta por telemedicina.'
        : ` Debes venir el dia *${bookingDate}* ${
            booking.block && booking.block.hourFrom ? ` a las ${booking.block.hourFrom}.` : `.`
          }`
    }${telemedicineInfo}

    Recuerda, tu número de reserva es: *${booking.number}*.

    Para detalles o cancelar, ingresa en este link:

    ${link}
    ${
      linkWs !== undefined
        ? `

    ¿Dudas? Contactanos:

    ${linkWs}

    `
        : ``
    }

    ¡Muchas gracias!
    `,
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
    ? `\n\n*Consulta por Telemedicina*\nTipo: ${telemedicineType}${
        booking.telemedicineConfig?.scheduledAt
          ? `\nFecha y Hora: ${new Date(booking.telemedicineConfig.scheduledAt).toLocaleString()}`
          : ''
      }`
    : '';

  const BOOKING_CONFIRM = {
    pt: `Olá, lembre-se da sua reserva em *${bookingCommerce.name}*!${
      isTelemedicine
        ? ' Esta é uma consulta por telemedicina.'
        : ` Deve vir no dia *${bookingDate}* ${
            booking.block && booking.block.hourFrom ? `as ${booking.block.hourFrom}.` : `.`
          }`
    }${telemedicineInfo}

    Poderá comparecer? Se sua resposta for *NÃO* por favor cancele sua reserva neste link:

    ${link}

    Obrigado!`,
    es: `Hola, recuerda tu reserva en *${bookingCommerce.name}*.${
      isTelemedicine
        ? ' Esta es una consulta por telemedicina.'
        : ` Debes venir el dia *${bookingDate}* ${
            booking.block && booking.block.hourFrom ? `a las ${booking.block.hourFrom}.` : `.`
          }`
    }${telemedicineInfo}

    Podrás venir? Si tu respues es *NO* por favor cancela tu reserva en este link:

    ${link}

    ¡Muchas gracias!`,
  };
  return BOOKING_CONFIRM[country];
};

export const getBookingCancelledMessage = (country, bookingCommerce, bookingDate, link) => {
  const BOOKING_CANCELLED = {
    pt: `Olá, sua reserva em *${bookingCommerce.name}* para o dia *${bookingDate}* foi cancelada.

    Para reservar de novo, acesse neste link:

    ${link}

    Obrigado!`,
    es: `Hola, tu reserva en *${bookingCommerce.name}* del dia *${bookingDate}* fue cancelada.

    Para reservar de nuevo, ingrese en este link:

    ${link}

    ¡Muchas gracias!`,
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
