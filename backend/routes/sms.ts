import { Router, Request, Response } from 'express';
import { smsLogs, getActiveConfig, sendSMS } from '../utils/smsGateway';
import { authenticateToken } from '../middleware/auth';
import { MockDatabase } from '../db';

const router = Router();

/**
 * @route GET /api/sms/logs
 * @desc Get all simulated/sent SMS messages
 */
router.get('/logs', authenticateToken, (req: Request, res: Response) => {
  res.json(smsLogs);
});

/**
 * @route GET /api/sms/config
 * @desc Get dynamic and fallback SMS Gateway configuration
 */
router.get('/config', authenticateToken, (req: Request, res: Response) => {
  try {
    const config = getActiveConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/sms/config
 * @desc Update dynamic SMS Gateway configuration
 */
router.post('/config', authenticateToken, (req: Request, res: Response) => {
  try {
    const { localAddress, publicAddress, username, password, deviceId, activeAddressType, simNumber, phoneFormat } = req.body;
    
    const newConfig = {
      localAddress: localAddress || '',
      publicAddress: publicAddress || '',
      username: username || '',
      password: password || '',
      deviceId: deviceId || '',
      activeAddressType: activeAddressType || 'simulated',
      simNumber: simNumber || '',
      phoneFormat: phoneFormat || 'as_entered'
    };

    MockDatabase.saveSmsConfig(newConfig);
    res.json({ message: 'SMS Gateway configuration updated successfully', config: getActiveConfig() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/sms/test
 * @desc Send a test SMS to a custom recipient to check credentials
 */
router.post('/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { testPhone, testMessage } = req.body;
    if (!testPhone) {
      return res.status(400).json({ error: 'Recipient phone number is required' });
    }
    const messageText = testMessage || 'Metro Dispatch SMS Gateway connection test. If you see this, your gateway integration is fully operational!';
    
    const result = await sendSMS('Test Recipient', testPhone, 'CUSTOMER', messageText);
    
    if (result.success) {
      res.json({
        message: result.simulated
          ? 'Gateway is in SIMULATION mode. Log created in dashboard feed.'
          : 'Live SMS message sent successfully through the Android SMS Gateway!',
        simulated: result.simulated
      });
    } else {
      res.status(500).json({
        error: result.error || 'Failed to dispatch test message'
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
