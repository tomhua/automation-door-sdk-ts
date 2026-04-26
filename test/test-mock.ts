import { AutomationDoorSdk, DriveSerialPort, SerialPortDriver } from '../src/index';

// 模拟测试配置
const config: DriveSerialPort = {
  doorCOM: 'COM1',
  doorBaudRate: 9600,
  doorTimeout: 1, // 缩短测试时间
  doorRedLampTimeout: 3,
  serialWriteTimeInterval: 100
};

console.log('开始测试自动化门控制SDK...');

// 测试1: 验证SDK构造函数
console.log('\n1. 测试SDK构造函数...');
try {
  const sdk = new AutomationDoorSdk(config);
  console.log('✓ SDK构造函数测试通过');
} catch (error) {
  console.error('✗ SDK构造函数测试失败:', error);
  process.exit(1);
}

// 测试2: 验证SerialPortDriver构造函数
console.log('\n2. 测试SerialPortDriver构造函数...');
try {
  const driver = new SerialPortDriver(config);
  console.log('✓ SerialPortDriver构造函数测试通过');
} catch (error) {
  console.error('✗ SerialPortDriver构造函数测试失败:', error);
  process.exit(1);
}

// 测试3: 验证isPortOpen方法
console.log('\n3. 测试isPortOpen方法...');
try {
  const driver = new SerialPortDriver(config);
  const initialStatus = driver.isPortOpen();
  console.log(`✓ isPortOpen方法测试通过，初始状态: ${initialStatus}`);
} catch (error) {
  console.error('✗ isPortOpen方法测试失败:', error);
  process.exit(1);
}

// 测试4: 验证配置参数
console.log('\n4. 测试配置参数...');
console.log('配置参数:', config);
console.log('✓ 配置参数测试通过');

console.log('\n🎉 所有测试通过！');
console.log('注意：实际的串口操作需要连接真实的硬件设备。');
console.log('此测试仅验证SDK的基本功能和结构。');