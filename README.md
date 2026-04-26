# 自动化门控制SDK

这是一个基于TypeScript的自动化门控制SDK，用于控制四道门的开关操作，支持串口通信。

## 功能特性

- 支持四道门同时开关
- 完整的开关门流程控制
- 灯光控制（黄灯、绿灯）
- 基于串口通信
- 配置灵活

## 安装

```bash
npm install automation-door-sdk-ts
```

## 使用方法

### 基本使用

```typescript
import { AutomationDoorSdk, DriveSerialPort } from 'automation-door-sdk-ts';

// 配置串口连接
const config: DriveSerialPort = {
  doorCOM: 'COM3', // 串口COM口
  doorBaudRate: 9600, // 波特率
  doorTimeout: 5, // 等待开关门超时时间（秒）
  doorRedLampTimeout: 3, // 红灯显示超时时间（秒）
  serialWriteTimeInterval: 100 // 发送指令间隔时间（毫秒）
};

// 创建SDK实例
const sdk = new AutomationDoorSdk(config);

// 执行开门流程
async function openDoors() {
  try {
    await sdk.openDoors();
    console.log('开门成功');
  } catch (error) {
    console.error('开门失败:', error);
  }
}

// 执行关门流程
async function closeDoors() {
  try {
    await sdk.closeDoors();
    console.log('关门成功');
  } catch (error) {
    console.error('关门失败:', error);
  }
}

// 使用示例
openDoors();
// 或
closeDoors();
```

### 流程说明

#### 开门流程
1. 打开串口连接
2. 四道门同时打开
3. 打开黄灯（工作状态）
4. 等待配置的超时时间（doorTimeout）
5. 关闭黄灯
6. 打开绿灯（完成状态）
7. 关闭绿灯

#### 关门流程
1. 打开串口连接
2. 四道门同时关闭
3. 打开黄灯（工作状态）
4. 等待配置的超时时间（doorTimeout）
5. 关闭黄灯
6. 打开绿灯（完成状态）
7. 关闭绿灯

## API 文档

### AutomationDoorSdk 类

#### 构造函数
```typescript
constructor(config: DriveSerialPort)
```
- `config`: 串口配置对象

#### 方法

##### openDoors()
```typescript
async openDoors(): Promise<void>
```
执行开门流程

##### closeDoors()
```typescript
async closeDoors(): Promise<void>
```
执行关门流程

##### open()
```typescript
async open(): Promise<void>
```
打开串口连接

##### close()
```typescript
async close(): Promise<void>
```
关闭串口连接

##### isPortOpen()
```typescript
isPortOpen(): boolean
```
检查串口是否打开

### DriveSerialPort 接口

```typescript
interface DriveSerialPort {
  /** 串口COM口 */
  doorCOM: string;
  /** 波特率 */
  doorBaudRate: number;
  /** 等待开关门超时时间单位是秒 */
  doorTimeout: number;
  /** 红灯显示超时时间单位是秒 */
  doorRedLampTimeout: number;
  /** 发送指令间隔时间，单位毫秒，默认为0.1秒，即100毫秒 */
  serialWriteTimeInterval: number;
}
```

## 命令配置

命令配置文件位于 `src/config/command.json`，定义了各设备的控制命令：

- 门设备（id: 1-4）
- 灯光设备（id: 5-8）
- 机器人设备（id: 9）
- 声音设备（id: 10）

## 依赖

- [serialport](https://www.npmjs.com/package/serialport) - 串口通信库

## 构建

```bash
npm run build
```

## 测试

```bash
npm test
```

## 许可证

ISC