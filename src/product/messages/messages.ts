export const getMessage = (type?, country?, productName?) => {
  const MESSAGES = {
    STOCK_PRODUCT_RECHARGE: {
      pt: {
        title: `O nível de ${productName} está baixo`,
        content: `O produto está abaixo do nível de recarga. Para obter detalhes, acesse ao Menu Principal > 'Gestão' > 'Estoque'`,
        icon: `bi-battery-charging`,
        toggle: 'stock-product-recharge'
      },
      es: {
        title: `El nivel de ${productName} está bajo`,
        content: `El producto está por debajo del nivel de recarga. Para detalles, accese al Menú Principal > 'Gestión' > 'Stock'`,
        icon: `bi-battery-charging`,
        toggle: 'stock-product-recharge'
      }
    }
  }
  let message = '';
  if (type) {
    message = MESSAGES[type];
    if (country) {
      message = MESSAGES[type][productName];
    }
  }
  return message;
}