// src/utils/printer.ts - Impresión de tickets térmicos (miniprint)

interface TicketItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  seatNumber?: number;
}

interface TicketData {
  restaurantName: string;
  mesa: string;
  mesero: string;
  items: TicketItem[];
  total: number;
  metodoPago: string;
  referencia?: string;
  montoRecibido: number;
  cambio: number;
  fecha: string;
  cuentaNumero?: number;
  cuentasTotales?: number;
}

// Formato de moneda mexicana: miles con coma, 2 decimales (ej. 1,565.00)
const formatoMXN = (valor: number): string =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);

function generarTicketHTML(data: TicketData): string {
  const line = (text: string, bold = false, center = false, size = 'small') =>
    `<div style="${center ? 'text-align:center;' : ''} font-size:${size === 'big' ? '16px' : '12px'}; font-weight:${bold ? 'bold' : 'normal'}; padding: 2px 0;">${text}</div>`;

  const separator = '<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>';

  const itemsHTML = data.items.map(item => {
    const lineTotal = item.price * item.quantity;
    const notesHTML = item.notes
      ? `<div style="font-size:10px; color:#666; padding-left:8px;">NOTA: ${item.notes}</div>`
      : '';
    const seatHTML = (item.seatNumber && item.seatNumber > 0)
      ? `<div style="font-size:9px; font-weight:bold; color:#000; padding-left:8px;">C.${item.seatNumber}</div>`
      : '';
    return `
      ${seatHTML}
      <div style="display:flex; justify-content:space-between; font-size:12px; padding: 1px 0;">
        <span>${item.quantity}x ${item.name}</span>
        <span>$${formatoMXN(lineTotal)}</span>
      </div>
      ${notesHTML}
    `;
  }).join('');

  return `
    <div style="font-family:'Courier New',monospace; width:80mm; padding:8px; background:white; color:black;">
       ${line(data.restaurantName, true, true, '12')}
       ${line('El Buen Café - Restaurante Gourmet', false, true)}
       ${(data.cuentaNumero && data.cuentasTotales && data.cuentasTotales > 1)
         ? line(`CUENTA ${data.cuentaNumero} de ${data.cuentasTotales}`, true, true, '12')
         : ''}
       ${separator}
       ${line(`Mesa: ${data.mesa}`, false, false)}
       ${line(`Mesero: ${data.mesero}`, false, false)}
       ${line(`Fecha: ${data.fecha}`, false, false)}
      ${separator}
      ${line('PRODUCTO', true)}
      ${separator}
      ${itemsHTML}
      ${separator}
      <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold;">
        <span>TOTAL</span>
        <span>$${formatoMXN(data.total)}</span>
      </div>
      ${separator}
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Método de pago:</span>
        <span>${data.metodoPago === 'efectivo' ? 'EFECTIVO' : data.metodoPago === 'electronico' ? 'TARJETA/TERMINAL' : data.metodoPago}</span>
      </div>
      ${data.referencia ? `<div style="font-size:11px;">Folio/Ref: ${data.referencia}</div>` : ''}
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Recibido:</span>
        <span>$${formatoMXN(data.montoRecibido)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Cambio:</span>
        <span>$${formatoMXN(data.cambio)}</span>
      </div>
      ${separator}
      ${line('¡Gracias por su visita!', false, true)}
      ${line('El Buen Café', false, true)}
    </div>
  `;
}

// ========== TICKET DE REPARTO ==========

interface DeliveryTicketData {
  restaurantName: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: TicketItem[];
  total: number;
  metodoPago: string;
  deliveryCharge: number;
  fecha: string;
}

function generarTicketRepartoHTML(data: DeliveryTicketData): string {
  const line = (text: string, bold = false, center = false, size = 'small') =>
    `<div style="${center ? 'text-align:center;' : ''} font-size:${size === 'big' ? '16px' : '12px'}; font-weight:${bold ? 'bold' : 'normal'}; padding: 2px 0;">${text}</div>`;

  const separator = '<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>';
  const doubleSeparator = '<div style="border-top: 3px double #000; margin: 6px 0;"></div>';

  const itemsHTML = data.items.map(item => {
    const lineTotal = item.price * item.quantity;
    const notesHTML = item.notes
      ? `<div style="font-size:10px; color:#666; padding-left:8px;">NOTA: ${item.notes}</div>`
      : '';
    return `
      <div style="display:flex; justify-content:space-between; font-size:12px; padding: 1px 0;">
        <span>${item.quantity}x ${item.name}</span>
        <span>$${lineTotal.toFixed(2)}</span>
      </div>
      ${notesHTML}
    `;
  }).join('');

  return `
    <div style="font-family:'Courier New',monospace; width:80mm; padding:8px; background:white; color:black;">
      ${line(data.restaurantName, true, true, '14')}
      ${line('TICKET DE REPARTO', true, true)}
      ${separator}
      ${line(`Pedido #${data.orderNumber}`, true, false, 'big')}
      ${separator}
      ${line('DATOS DE ENTREGA', true)}
      ${line(`Cliente: ${data.customerName}`, false, false)}
      ${line(`Teléfono: ${data.customerPhone}`, false, false)}
      ${line(`Dirección: ${data.address}`, false, false)}
      ${doubleSeparator}
      ${line('PRODUCTOS', true)}
      ${separator}
      ${itemsHTML}
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Costo de envío:</span>
        <span>$${data.deliveryCharge.toFixed(2)}</span>
      </div>
      ${separator}
      <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold;">
        <span>TOTAL A COBRAR</span>
        <span>$${data.total.toFixed(2)}</span>
      </div>
      ${doubleSeparator}
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Método de pago:</span>
        <span>${data.metodoPago}</span>
      </div>
      ${data.metodoPago === 'EFECTIVO' ? line('⚠️ PREPARAR CAMBIO', true, true) : ''}
      ${separator}
      ${line(`Fecha: ${data.fecha}`, false, true)}
      ${line('¡Gracias por su preferencia!', false, true)}
    </div>
  `;
}

export function imprimirTicketReparto(data: DeliveryTicketData): void {
  const html = generarTicketRepartoHTML(data);

  const ventana = window.open('', '_blank', 'width=400,height=700');
  if (!ventana) {
    alert('Permite ventanas emergentes para imprimir el ticket de reparto');
    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket Reparto #${data.orderNumber} - El Buen Café</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        body { margin: 0; padding: 0; }
        @media print {
          body { width: 80mm; }
        }
      </style>
    </head>
    <body>
      ${html}
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
          setTimeout(function() { window.close(); }, 1000);
        };
      <\/script>
    </body>
    </html>
  `);
  ventana.document.close();
}

export function imprimirTicket(data: TicketData): void {
  const html = generarTicketHTML(data);

  // Abrir ventana de impresión
  const ventana = window.open('', '_blank', 'width=400,height=600');
  if (!ventana) {
    alert('Permite ventanas emergentes para imprimir el ticket');
    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket - El Buen Café</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        body { margin: 0; padding: 0; }
        @media print {
          body { width: 80mm; }
        }
      </style>
    </head>
    <body>
      ${html}
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
          setTimeout(function() { window.close(); }, 1000);
        };
      <\/script>
    </body>
    </html>
  `);
  ventana.document.close();
}