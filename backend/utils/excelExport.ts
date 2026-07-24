import * as XLSX from 'xlsx';

export interface FormattedOrderExport {
  'Order #': number;
  'Customer': string;
  'Customer Phone': string;
  'Customer Type': string;
  'Driver': string;
  'Driver Phone': string;
  'Pickup Address': string;
  'Delivery Address': string;
  'Fee (ETB)': number;
  'Payment Type': string;
  'Payment Status': string;
  'Order Status': string;
  'Created At': string;
}

/**
 * Generates an Excel spreadsheet for Daily Dispatch Logs
 */
export function generateDailyDispatchExcel(orders: any[]): Buffer {
  const formattedData: FormattedOrderExport[] = orders.map((order) => {
    const cust = order.customer && typeof order.customer === 'object' ? order.customer : null;
    const drv = order.driver && typeof order.driver === 'object' ? order.driver : null;

    return {
      'Order #': order.orderNumber || 0,
      'Customer': cust ? cust.name : 'Unknown',
      'Customer Phone': cust ? cust.phone : 'N/A',
      'Customer Type': cust ? cust.type : 'N/A',
      'Driver': drv ? drv.name : 'Unassigned',
      'Driver Phone': drv ? drv.phone : 'N/A',
      'Pickup Address': order.pickupAddress,
      'Delivery Address': order.deliveryAddress,
      'Fee (ETB)': order.fee || 0,
      'Payment Type': order.paymentType,
      'Payment Status': order.paymentStatus,
      'Order Status': order.orderStatus,
      'Created At': order.createdAt ? new Date(order.createdAt).toLocaleString() : ''
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formattedData);

  // Auto-fit column widths
  const maxProps = Object.keys(formattedData[0] || {});
  const wsCols = maxProps.map((key) => {
    let maxLen = key.length;
    formattedData.forEach((row: any) => {
      const val = String(row[key] ?? '');
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    return { wch: Math.min(maxLen + 3, 50) };
  });
  ws['!cols'] = wsCols;

  XLSX.utils.book_append_sheet(wb, ws, 'Daily Dispatch Log');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Generates an Excel spreadsheet for Account Holder Statement
 */
export function generateAccountStatementExcel(customer: any, orders: any[]): Buffer {
  // Main summary info
  const summaryInfo = [
    { Label: 'Account Holder Statement', Value: '' },
    { Label: 'Customer Name', Value: customer.name },
    { Label: 'Phone Number', Value: customer.phone },
    { Label: 'Billing Address', Value: customer.address },
    { Label: 'Outstanding Balance (ETB)', Value: customer.creditBalance.toFixed(2) },
    { Label: 'Statement Date', Value: new Date().toLocaleString() },
    { Label: '', Value: '' } // empty spacer row
  ];

  // Table of orders
  const itemizedOrders = orders.map((order) => {
    const drv = order.driver && typeof order.driver === 'object' ? order.driver : null;
    return {
      'Order #': order.orderNumber || 0,
      'Date': order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '',
      'Pickup Address': order.pickupAddress,
      'Delivery Address': order.deliveryAddress,
      'Driver': drv ? drv.name : 'N/A',
      'Amount Due (ETB)': order.fee || 0,
      'Payment Status': order.paymentStatus,
      'Order Status': order.orderStatus
    };
  });

  const wb = XLSX.utils.book_new();
  
  // Combine custom header rows with table JSON
  const ws = XLSX.utils.json_to_sheet([]);
  
  // Append summary metadata
  XLSX.utils.sheet_add_json(ws, summaryInfo, { skipHeader: true, origin: 'A1' });
  
  // Append table headers and values starting at A9
  XLSX.utils.sheet_add_json(ws, itemizedOrders, { origin: 'A9' });

  // Auto-fit column widths
  const wsCols = [
    { wch: 25 }, // Col A
    { wch: 15 }, // Col B
    { wch: 30 }, // Col C
    { wch: 30 }, // Col D
    { wch: 20 }, // Col E
    { wch: 15 }, // Col F
    { wch: 15 }, // Col G
    { wch: 15 }  // Col H
  ];
  ws['!cols'] = wsCols;

  XLSX.utils.book_append_sheet(wb, ws, 'Account Statement');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Generates an Excel spreadsheet for driver commission accounting
 */
export function generateDriverCommissionExcel(drivers: any[], deliveredOrders: any[], settlements: any[] = []): Buffer {
  const summaryHeaders = [
    'Driver',
    'Phone',
    'Completed Deliveries',
    'Current Commission Balance (ETB)',
    'Previously Paid Commission (ETB)',
    'Commission Rate'
  ];
  const deliveryHeaders = [
    'Order #',
    'Date',
    'Driver',
    'Driver Phone',
    'Delivery Fee (ETB)',
    'Commission Rate',
    'Commission Earned (ETB)'
  ];
  const settlementHeaders = [
    'Settlement Date',
    'Commission Month',
    'Driver',
    'Driver Phone',
    'Commission Paid (ETB)',
    'Status'
  ];

  const summaryData = drivers.map((driver) => ({
    'Driver': driver.name,
    'Phone': driver.phone,
    'Completed Deliveries': deliveredOrders.filter((order) => {
      const driverId = typeof order.driver === 'object' && order.driver !== null ? order.driver._id : order.driver;
      return driverId === driver._id;
    }).length,
    'Current Commission Balance (ETB)': Number(driver.commissionBalance || 0),
    'Previously Paid Commission (ETB)': settlements
      .filter((settlement) => settlement.driver === driver._id)
      .reduce((total, settlement) => total + Number(settlement.amount || 0), 0),
    'Commission Rate': '10%'
  }));

  const deliveryData = deliveredOrders.map((order) => {
    const driver = order.driver && typeof order.driver === 'object' ? order.driver : null;
    const fee = Number(order.fee || 0);
    return {
      'Order #': order.orderNumber || 0,
      'Date': order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '',
      'Driver': driver ? driver.name : 'Unknown',
      'Driver Phone': driver ? driver.phone : 'N/A',
      'Delivery Fee (ETB)': fee,
      'Commission Rate': '10%',
      'Commission Earned (ETB)': fee * 0.10
    };
  });

  const settlementData = settlements.map((settlement) => ({
    'Settlement Date': settlement.settledAt ? new Date(settlement.settledAt).toLocaleString() : '',
    'Commission Month': settlement.settledAt ? new Date(settlement.settledAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '',
    'Driver': settlement.driverName,
    'Driver Phone': settlement.driverPhone,
    'Commission Paid (ETB)': Number(settlement.amount || 0),
    'Status': 'PAID'
  }));

  const wb = XLSX.utils.book_new();
  const summaryWs = XLSX.utils.json_to_sheet(summaryData, { header: summaryHeaders });
  const deliveryWs = XLSX.utils.json_to_sheet(deliveryData, { header: deliveryHeaders });
  const settlementWs = XLSX.utils.json_to_sheet(settlementData, { header: settlementHeaders });

  summaryWs['!cols'] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 30 },
    { wch: 32 },
    { wch: 18 }
  ];
  deliveryWs['!cols'] = [
    { wch: 12 },
    { wch: 15 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 25 }
  ];
  settlementWs['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Commission Summary');
  XLSX.utils.book_append_sheet(wb, deliveryWs, 'Completed Deliveries');
  XLSX.utils.book_append_sheet(wb, settlementWs, 'Commission Paid History');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
