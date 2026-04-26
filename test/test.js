import { AutomationDoorSdk } from '../src/index';
const config = {
    doorCOM: 'COM1',
    doorBaudRate: 9600,
    doorTimeout: 5,
    doorRedLampTimeout: 3,
    serialWriteTimeInterval: 100
};
const sdk = new AutomationDoorSdk(config);
// 打开串口
await sdk.open();
// 检查串口是否打开
if (!sdk.isPortOpen()) {
    throw new Error('串口未打开');
}
// 开门
await sdk.openDoors();
// 关门
await sdk.closeDoors();
// 关闭串口
await sdk.close();
