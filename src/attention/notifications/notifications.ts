export const getFaltanCincoMessage = (country, attention) => {
  const FALTANCINCO = {
    pt: `😃 Olá, quase É a sua vez! Restam *${5}* pessoas para serem atendidas.

    Lémbre-se, seu número de atendimento é: *${attention.number}*.`,
    es: `😃 Hola, ya casi Es tu Turno! Faltan *${5}* personas para que seas atendido.

    Recuerda, tu número de atención es: *${attention.number}*.`
  };
  return FALTANCINCO[country];
}

export const getFaltaUnoMessage = (country, attention) => {
  const FALTAUNO = {
    pt: `😃 Olá, quase É a sua vez! Restam *${1}* pessoa para você ser tratado.

    Lémbre-se, seu número de atendimento é: *${attention.number}*`,
    es: `😃 Hola, ¡ya casi Es tu Turno!. Falta *${1}* persona para que seas atendido.

    Recuerda, tu número de atención es: *${attention.number}*`
  };
  return FALTAUNO[country];
}

export const getEsTuTunoMessage = (country, attention, moduleNumber) => {
  const ESTUTURNO = {
    pt: `🚨 Olá, agora É a sua Vez! Aproxime-se do módulo *${moduleNumber}*.

    Lémbre-se, seu número de atendimento é: *${attention.number}*.`,
    es: `🚨 Hola, ahora ¡Es tu Turno! Acércate al módulo *${moduleNumber}*.

    Recuerda, tu número de atención es: *${attention.number}*.`
  }
  return ESTUTURNO[country];
}

export const getEncuestaMessage = (country, attention, link) => {
  const ENCUESTA = {
    pt: `😃 Obrigado por se atender em *${attention.commerce.name}*!

    Como foi o atendimento? Sua opinião e muito importante pra nós. ⭐️ Ingresse aqui e avalie-nos, é menos de um minuto:

    ${link}

    Se você não conseguir acessar o link diretamente, responda a esta mensagem ou adicione-nos aos seus contatos. Volte sempre!`,
    es: `😃 ¡Gracias por atenderte en *${attention.commerce.name}*!

    ¿Cómo estuvo la atención? Tu opinión es muy importante para nosotros. ⭐️ Entra aquí y califícanos, te tomará sólo 15 segundos:

    ${link}

    Si no puedes acceder al link directamente, contesta este mensaje o agreganos a tus contactos. Vuelve pronto!`
  }
  return ENCUESTA[country];
}

export const getAtencionCanceladaMessage = (country, attention, link) => {
  const ATTENTION_CANCELLED = {
    pt: `Olá, seu atendimento em *${attention.commerce.name}* foi cancelada.

    Para obter um atendimento novo, acesse neste link:

    ${link}

    Obrigado!`,
    es: `Hola, tu atención en *${attention.commerce.name}* fue cancelada.

    Para reservar de nuevo, ingrese en este link:

    ${link}

    ¡Muchas gracias!`
  }
  return ATTENTION_CANCELLED[country];
}