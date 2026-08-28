import dotenv from 'dotenv';
import { MockDatabase } from '../db';
dotenv.config();

export interface SmsPayload {
  phoneNumbers: string[];
  textMessage?: {
    text: string;
  };
  deviceId?: string;
  simNumber?: number;
}

// Log of sent messages for dashboard visibility
export interface SmsLogEntry {
  id: string;
  recipientName: string;
  recipientPhone: string;
  role: 'CUSTOMER' | 'DRIVER';
  message: string;
  timestamp: string;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  error?: string;
}

export const smsLogs: SmsLogEntry[] = [];

/**
 * Gets the active SMS gateway configuration, combining DB settings and env fallbacks
 */
export function getActiveConfig() {
  const dbConfig = MockDatabase.getSmsConfig();
  
  let address = '';
  if (dbConfig.activeAddressType === 'public') {
    address = dbConfig.publicAddress;
  } else if (dbConfig.activeAddressType === 'local') {
    address = dbConfig.localAddress;
  } else if (dbConfig.activeAddressType === 'simulated') {
    address = '';
  } else {
    address = dbConfig.publicAddress || dbConfig.localAddress || process.env.SMS_GATEWAY_ADDRESS || '';
  }

  const username = dbConfig.username || process.env.SMS_GATEWAY_USERNAME || '';
  const password = dbConfig.password || process.env.SMS_GATEWAY_PASSWORD || '';
  const deviceId = dbConfig.deviceId || process.env.SMS_GATEWAY_DEVICE_ID || '';
  const activeAddressType = dbConfig.activeAddressType || (address ? 'public' : 'simulated');
  const simNumber = dbConfig.simNumber || '';
  const phoneFormat = dbConfig.phoneFormat || 'as_entered';

  return {
    localAddress: dbConfig.localAddress || '',
    publicAddress: dbConfig.publicAddress || '',
    address,
    username,
    password,
    deviceId,
    activeAddressType,
    simNumber,
    phoneFormat
  };
}

/**
 * Encodes username and password into a Basic Auth header
 */
function getBasicAuthHeader(username?: string, password?: string): string {
  const u = username || '';
  const p = password || '';
  if (!u || !p) return '';
  const credentials = `${u}:${p}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Formats a local phone number based on preferred gateway/carrier format
 */
export function formatPhoneNumber(phone: string, format: string = 'as_entered'): string {
  // Strip non-digit characters except maybe '+'
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Extract pure digits
  let digits = cleaned.replace(/\D/g, '');

  // Parse Ethiopian carrier number patterns (e.g., 251911305288, 0911305288, 911305288)
  let ethiopianDigits = '';
  if (digits.startsWith('251') && digits.length === 12) {
    ethiopianDigits = digits.slice(3); // remove 251
  } else if (digits.startsWith('0') && digits.length === 10) {
    ethiopianDigits = digits.slice(1); // remove 0
  } else if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length === 9) {
    ethiopianDigits = digits;
  }

  // If we couldn't parse it as standard Ethiopian digits, return cleaned input
  if (!ethiopianDigits) {
    return cleaned || phone;
  }

  // Format based on preference
  switch (format) {
    case 'with_plus':
      return `+251${ethiopianDigits}`;
    case 'no_plus':
      return `251${ethiopianDigits}`;
    case 'local':
      return `0${ethiopianDigits}`;
    case 'as_entered':
    default:
      return phone; // Return exactly what was typed
  }
}

/**
 * Sends an SMS message via the Android SMS Gateway
 */
export async function sendSMS(
  recipientName: string,
  recipientPhone: string,
  role: 'CUSTOMER' | 'DRIVER',
  message: string
): Promise<{ success: boolean; simulated: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  const id = 'sms-' + Math.random().toString(36).substring(2, 11);

  const { address, username, password, deviceId, activeAddressType, simNumber, phoneFormat } = getActiveConfig();

  // If gateway configuration is missing or set to simulated, run in Simulated/Sandbox mode
  if (activeAddressType === 'simulated' || !address || !username || !password) {
    const logMsg = `[SMS SIMULATION] To: ${recipientName} (${recipientPhone}) [${role}] | Message: "${message}"`;
    console.log(logMsg);

    smsLogs.unshift({
      id,
      recipientName,
      recipientPhone,
      role,
      message,
      timestamp,
      status: 'SIMULATED'
    });

    return { success: true, simulated: true };
  }

  try {
    const authHeader = getBasicAuthHeader(username, password);
    const formattedPhone = formatPhoneNumber(recipientPhone, phoneFormat);
    const payload: SmsPayload = {
      phoneNumbers: [formattedPhone],
      textMessage: {
        text: message
      },
      deviceId: deviceId || undefined,
      simNumber: simNumber ? parseInt(simNumber, 10) : undefined
    };

    const response = await fetch(`${address.replace(/\/$/, '')}/3rdparty/v1/messages?skipPhoneValidation=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SMS Gateway HTTP ${response.status}: ${errorText}`);
    }

    smsLogs.unshift({
      id,
      recipientName,
      recipientPhone,
      role,
      message,
      timestamp,
      status: 'SENT'
    });

    return { success: true, simulated: false };
  } catch (error: any) {
    console.error(`Failed to send SMS to ${recipientName} (${recipientPhone}):`, error.message);
    
    smsLogs.unshift({
      id,
      recipientName,
      recipientPhone,
      role,
      message,
      timestamp,
      status: 'FAILED',
      error: error.message
    });

    return { success: false, simulated: false, error: error.message };
  }
}

/**
 * Build customized SMS text for cancelled orders to Customers
 */
export function buildCancellationCustomerSMS(customerName: string, orderNumber: number): string {
  return `ሰላም ${customerName}፣ ያዘዙት ዕቃ (ትዕዛዝ ቁጥር #${orderNumber}) ተሰርዟል ለበለጠ መረጃ በስልክ ቁጥር 0911826617 ይደውሉ እናመሰግናለን!`;
}

/**
 * Build customized SMS text for cancelled orders to Drivers
 */
export function buildCancellationDriverSMS(driverName: string, orderNumber: number, customerName: string, customerPhone: string): string {
  return `ሰላም ${driverName}፣ ትዕዛዝ ቁጥር #${orderNumber} ተሰርዟል። ደንበኛ፡- ${customerName} (${customerPhone})። እባክዎ ይህን ትዕዛዝ ያስተውሉ ለበለጠ መረጃ በስልክ ቁጥር 0911826617 ይደውሉ።`;
}

/**
 * Build customized SMS text for Customers
 */
export function buildCustomerSMS(customerName: string, orderNumber: number, driverName: string, driverPhone: string, pickup: string, delivery: string, paymentType: string, fee: number): string {
  if (paymentType === 'CREDIT') {
    return `ሰላም ${customerName}፣ ያዘዙት ዕቃ ትዕዛዝ ቁጥር #${orderNumber} ተልኳል። መነሻ (ፒክአፕ)፡- ${pickup} | ማድረሻ (ዴሊቨሪ)፡ ${delivery}። አሽከርካሪ፡- ${driverName} (${driverPhone})። በሂሳብዎ (አካውንት ክሬዲት) ተይዟል። የአገልግሎት ዋጋ፡- ${fee.toFixed(2)} ብር። ዕቃው ሲደርስ ምንም ዓይነት ክፍያ መክፈል አያስፈልግዎትም። እናመሰግናለን!`;
  }

  return `ሰላም ${customerName}፣ ያዘዙት ዕቃ ትዕዛዝ ቁጥር #${orderNumber} ተልኳል። አሽከርካሪ፡- ${driverName} (${driverPhone})። እባክዎ ዕቃው ሲደርስዎ ለአሽከርካሪው ${fee.toFixed(2)} ብር ይክፈሉ። እናመሰግናለን!`;
}

/**
 * Build customized SMS text for Drivers
 */
export function buildDriverSMS(driverName: string, orderNumber: number, customerName: string, customerPhone: string, pickup: string, delivery: string, paymentType: string, fee: number): string {
  if (paymentType === 'CREDIT') {
    return `ሰላም ${driverName}፣ አዲስ ትዕዛዝ ቁጥር #${orderNumber} ለእርስዎ ተመድቧል። መነሻ (ፒክአፕ)፡- ${pickup} | ማድረሻ (ዴሊቨሪ)፡ ${delivery} | ደንበኛ፡- ${customerName} (${customerPhone})። መመሪያ፡- ዕቃው ሲደርስ ${fee.toFixed(2)} ብር በደንበኛችን ክሬዲት አካውንት ላይ ስለተመዘገበ  ክፍያውን መሰብሰብ አይጠበቅብዎትም።`;
  }

  return `ሰላም ${driverName}፣ አዲስ ትዕዛዝ ቁጥር #${orderNumber} ለእርስዎ ተመድቧል። መነሻ (ፒክአፕ)፡- ${pickup} | ማድረሻ (ዴሊቨሪ)፡ ${delivery} | ደንበኛ፡- ${customerName} (${customerPhone})። መመሪያ፡- ዕቃው ሲደርስ ${fee.toFixed(2)} ብር ይሰብስቡ።`;
}
