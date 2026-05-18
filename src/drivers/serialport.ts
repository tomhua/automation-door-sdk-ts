import { SerialPort } from 'serialport';
import { DriveSerialPort } from '../types/drive_types';
import * as commands from '../config/command.json';

/**
 * 日志工具类
 */
class Logger {
  private static timestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 23);
  }

  static info(message: string, ...args: unknown[]): void {
    console.log(`[${Logger.timestamp()}] [INFO] ${message}`, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`[${Logger.timestamp()}] [WARN] ${message}`, ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(`[${Logger.timestamp()}] [ERROR] ${message}`, ...args);
  }

  static debug(message: string, ...args: unknown[]): void {
    console.debug(`[${Logger.timestamp()}] [DEBUG] ${message}`, ...args);
  }

  static command(device: string, action: string, command: string): void {
    console.log(`[${Logger.timestamp()}] [CMD] ${device} ${action}: ${command}`);
  }

  static step(step: string): void {
    console.log(`[${Logger.timestamp()}] [STEP] ${step}`);
  }
}

/**
 * 命令项接口，定义了设备的命令结构
 */
export interface CommandItem {
  /** 命令ID */
  id: string;
  /** 设备类别（door, lamp, robot, sound） */
  category: string;
  /** 开启命令（十六进制字符串） */
  open: string;
  /** 关闭命令（十六进制字符串） */
  close: string;
  /** 传感器列表（可选） */
  sensors?: string[];
  /** 灯光颜色（可选） */
  color?: string;
}

/** 命令列表，从配置文件加载 */
const commandList: CommandItem[] = commands as unknown as CommandItem[];

/**
 * 串口驱动类，负责与硬件设备的串口通信
 */
export class SerialPortDriver {
  /** 串口实例 */
  private port: SerialPort | null = null;
  /** 串口是否打开 */
  private isOpen: boolean = false;
  /** 串口配置 */
  private config: DriveSerialPort;
  /** 发送指令间隔时间（毫秒） */
  private readonly writeInterval: number;

  /**
   * 构造函数
   * @param config 串口配置
   */
  constructor(config: DriveSerialPort) {
    this.config = config;
    this.writeInterval = config.serialWriteTimeInterval || 100;
    Logger.info(`SerialPortDriver initialized with config: ${JSON.stringify(config)}`);
  }

  /**
   * 打开串口连接
   * @returns Promise
   */
  async open(): Promise<void> {
    if (this.isOpen) {
      Logger.warn('Serial port is already open, skipping open');
      return;
    }

    Logger.info(`Opening serial port: ${this.config.doorCOM} at ${this.config.doorBaudRate} baud`);

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.config.doorCOM,
        baudRate: this.config.doorBaudRate,
      });

      this.port.open((err) => {
        if (err) {
          Logger.error(`Failed to open serial port: ${err.message}`);
          reject(err);
          return;
        }
        this.isOpen = true;
        Logger.info(`Serial port ${this.config.doorCOM} opened successfully`);
        resolve();
      });
    });
  }

  /**
   * 关闭串口连接
   * @returns Promise
   */
  async close(): Promise<void> {
    if (!this.isOpen) {
      Logger.warn('Serial port is already closed, skipping close');
      return;
    }

    Logger.info(`Closing serial port: ${this.config.doorCOM}`);

    return new Promise((resolve, reject) => {
      if (!this.port || !this.isOpen) {
        resolve();
        return;
      }

      this.port.close((err) => {
        if (err) {
          Logger.error(`Failed to close serial port: ${err.message}`);
          reject(err);
          return;
        }
        this.isOpen = false;
        this.port = null;
        Logger.info(`Serial port ${this.config.doorCOM} closed successfully`);
        resolve();
      });
    });
  }

  /**
   * 将十六进制字符串转换为Buffer
   * @param hex 十六进制字符串
   * @returns Buffer
   */
  private hexStringToBuffer(hex: string): Buffer {
    const cleanHex = hex.replace(/\s/g, '');
    return Buffer.from(cleanHex, 'hex');
  }

  /**
   * 发送命令到设备
   * @param hexCommand 十六进制命令字符串
   * @param deviceName 设备名称
   * @param action 操作类型
   * @returns Promise
   */
  private async writeCommand(hexCommand: string, deviceName: string = 'Unknown', action: string = 'execute'): Promise<void> {
    if (!this.port || !this.isOpen) {
      const errorMsg = 'Serial port is not open';
      Logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    Logger.command(deviceName, action, hexCommand);

    return new Promise((resolve, reject) => {
      const buffer = this.hexStringToBuffer(hexCommand);
      this.port!.write(buffer, (err) => {
        if (err) {
          Logger.error(`Failed to write command: ${err.message}`);
          reject(err);
          return;
        }
        Logger.debug(`Command sent successfully, waiting ${this.writeInterval}ms before next command`);
        setTimeout(resolve, this.writeInterval);
      });
    });
  }

  /**
   * 获取所有门设备的命令
   * @returns 门设备命令列表
   */
  private getDoors(): CommandItem[] {
    return commandList.filter((cmd: CommandItem) => cmd.category === 'door');
  }

  /**
   * 获取所有黄灯设备的命令
   * @returns 黄灯设备命令列表
   */
  private getYellowLamps(): CommandItem[] {
    return commandList.filter((cmd: CommandItem) => cmd.category === 'lamp' && cmd.color === 'yellow');
  }

  /**
   * 获取所有绿灯设备的命令
   * @returns 绿灯设备命令列表
   */
  private getGreenLamps(): CommandItem[] {
    return commandList.filter((cmd: CommandItem) => cmd.category === 'lamp' && cmd.color === 'green');
  }

  /**
   * 向多个设备发送命令
   * @param items 设备命令列表
   * @param commandType 命令类型（open或close）
   * @param deviceType 设备类型描述
   * @returns Promise
   */
  private async sendToAll(items: CommandItem[], commandType: 'open' | 'close', deviceType: string): Promise<void> {
    const actionText = commandType === 'open' ? '打开' : '关闭';
    Logger.info(`Sending ${actionText} command to ${items.length} ${deviceType}(s)`);

    const promises = items.map((item: CommandItem) => {
      const cmd = commandType === 'open' ? item.open : item.close;
      const deviceName = `${deviceType}-${item.id}`;
      return this.writeCommand(cmd, deviceName, actionText);
    });
    await Promise.all(promises);

    Logger.info(`Successfully sent ${actionText} command to ${items.length} ${deviceType}(s)`);
  }

  /**
   * 开门流程：开门->开黄灯->开完成->关黄灯->开绿灯->关绿灯
   * @returns Promise
   */
  async openDoors(): Promise<void> {
    Logger.step('========== 开始执行开门流程 ==========');

    await this.open();

    const doors = this.getDoors();
    const yellowLamps = this.getYellowLamps();
    const greenLamps = this.getGreenLamps();

    Logger.step('步骤1: 四道门同时打开');
    await this.sendToAll(doors, 'open', '门');

    Logger.step('步骤2: 打开黄灯');
    await this.sendToAll(yellowLamps, 'open', '黄灯');

    Logger.step(`步骤3: 等待开门完成（${this.config.doorTimeout}秒）`);
    await new Promise(resolve => setTimeout(resolve, this.config.doorTimeout * 1000));

    Logger.step('步骤4: 关闭黄灯');
    await this.sendToAll(yellowLamps, 'close', '黄灯');

    Logger.step('步骤5: 打开绿灯（开门完成）');
    await this.sendToAll(greenLamps, 'open', '绿灯');

    Logger.step(`步骤6: 等待绿灯显示（${this.config.doorRedLampTimeout}秒）`);
    await new Promise(resolve => setTimeout(resolve, this.config.doorRedLampTimeout * 1000));

    Logger.step('步骤7: 关闭绿灯');
    await this.sendToAll(greenLamps, 'close', '绿灯');

    Logger.step('========== 开门流程执行完成 ==========');
  }

  /**
   * 关门流程：关门->开黄灯->关完成->关黄灯->开绿灯->关绿灯
   * @returns Promise
   */
  async closeDoors(): Promise<void> {
    Logger.step('========== 开始执行关门流程 ==========');

    await this.open();

    const doors = this.getDoors();
    const yellowLamps = this.getYellowLamps();
    const greenLamps = this.getGreenLamps();

    Logger.step('步骤1: 四道门同时关闭');
    await this.sendToAll(doors, 'close', '门');

    Logger.step('步骤2: 打开黄灯');
    await this.sendToAll(yellowLamps, 'open', '黄灯');

    Logger.step(`步骤3: 等待关门完成（${this.config.doorTimeout}秒）`);
    await new Promise(resolve => setTimeout(resolve, this.config.doorTimeout * 1000));

    Logger.step('步骤4: 关闭黄灯');
    await this.sendToAll(yellowLamps, 'close', '黄灯');

    Logger.step('步骤5: 打开绿灯（关门完成）');
    await this.sendToAll(greenLamps, 'open', '绿灯');

    Logger.step(`步骤6: 等待绿灯显示（${this.config.doorRedLampTimeout}秒）`);
    await new Promise(resolve => setTimeout(resolve, this.config.doorRedLampTimeout * 1000));

    Logger.step('步骤7: 关闭绿灯');
    await this.sendToAll(greenLamps, 'close', '绿灯');

    Logger.step('========== 关门流程执行完成 ==========');
  }

  /**
   * 检查串口是否打开
   * @returns 串口是否打开
   */
  isPortOpen(): boolean {
    return this.isOpen;
  }
}