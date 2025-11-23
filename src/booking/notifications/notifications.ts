import { htmlTemplate as TERMS_AND_CONDITIONS_ES } from '../templates/terms_and_conditions_es';
import { htmlTemplate as TERMS_AND_CONDITIONS_PT } from '../templates/terms_and_conditions_pt';

export const getBookingMessage = (country, bookingCommerce, booking, bookingDate, link, linkWs) => {
  const BOOKING = {
    pt: `Olá, sua reserva em *${
      bookingCommerce.name
    }* foi feita com sucesso! Você deve vir no dia *${bookingDate}* ${
      booking.block && booking.block.hourFrom ? ` as ${booking.block.hourFrom}.` : `.`
    }

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
    es: `Hola, tu reserva en *${
      bookingCommerce.name
    }* fue generada con éxito. Debes venir el dia *${bookingDate}* ${
      booking.block && booking.block.hourFrom ? ` a las ${booking.block.hourFrom}.` : `.`
    }

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
  const BOOKING_CONFIRM = {
    pt: `Olá, lembre-se da sua reserva em *${
      bookingCommerce.name
    }*! Deve vir no dia *${bookingDate}* ${
      booking.block && booking.block.hourFrom ? `as ${booking.block.hourFrom}.` : `.`
    }

    Poderá comparecer? Se sua resposta for *NÃO* por favor cancele sua reserva neste link:

    ${link}

    Obrigado!`,
    es: `Hola, recuerda tu reserva en *${
      bookingCommerce.name
    }*. Debes venir el dia *${bookingDate}* ${
      booking.block && booking.block.hourFrom ? `a las ${booking.block.hourFrom}.` : `.`
    }

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
