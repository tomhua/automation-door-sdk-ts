import { AutomationDoorSdk, DriveSerialPort } from '../src/index';

const config: DriveSerialPort = {
  doorCOM: 'COM3',
  doorBaudRate: 9600,
  doorTimeout: 5,
  doorRedLampTimeout: 3,
  serialWriteTimeInterval: 100
};

async function runTest() {
  console.log('开始测试自动化门控制SDK...');

  try {
    const sdk = new AutomationDoorSdk(config);

    console.log('1. 打开串口...');
    await sdk.open();

    console.log('2. 检查串口是否打开...');
    if (!sdk.isPortOpen()) {
      throw new Error('串口未打开');
    }
    console.log('串口已打开');

    console.log('3. 执行开门流程...');
    await sdk.openDoors();
    console.log('开门流程执行完成');

    console.log('4. 执行关门流程...');
    await sdk.closeDoors();
    console.log('关门流程执行完成');

    console.log('5. 关闭串口...');
    await sdk.close();
    console.log('串口已关闭');

    console.log('测试完成，所有操作成功！');
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

runTest();
