import { SerialPort } from 'serialport';
import { DriveSerialPort } from '../types/drive_types';
import * as commands from '../config/command.json';

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
  }

  /**
   * 打开串口连接
   * @returns Promise
   */
  async open(): Promise<void> {
    // 检查串口是否已打开
    if (this.isOpen) {
      return;
    }
    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.config.doorCOM,
        baudRate: this.config.doorBaudRate,
      });

      this.port.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.isOpen = true;
        resolve();
      });
    });
  }

  /**
   * 关闭串口连接
   * @returns Promise
   */
  async close(): Promise<void> {
    // 检查串口是否已关闭
    if (!this.isOpen) {
      return;
    }
    return new Promise((resolve, reject) => {
      if (!this.port || !this.isOpen) {
        resolve();
        return;
      }

      this.port.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.isOpen = false;
        this.port = null;
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
   * @returns Promise
   */
  private async writeCommand(hexCommand: string): Promise<void> {
    if (!this.port || !this.isOpen) {
      throw new Error('Serial port is not open');
    }

    return new Promise((resolve, reject) => {
      const buffer = this.hexStringToBuffer(hexCommand);
      this.port!.write(buffer, (err) => {
        if (err) {
          reject(err);
          return;
        }
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
   * @returns Promise
   */
  private async sendToAll(items: CommandItem[], commandType: 'open' | 'close'): Promise<void> {
    const promises = items.map((item: CommandItem) => {
      const cmd = commandType === 'open' ? item.open : item.close;
      return this.writeCommand(cmd);
    });
    await Promise.all(promises);
  }

  /**
   * 开门流程：开门->开黄灯->开完成->关黄灯->开绿灯->关绿灯
   * @returns Promise
   */
  async openDoors(): Promise<void> {
    await this.open();

    const doors = this.getDoors();
    const yellowLamps = this.getYellowLamps();
    const greenLamps = this.getGreenLamps();

    // 四道门同时打开
    await this.sendToAll(doors, 'open');

    // 打开黄灯
    await this.sendToAll(yellowLamps, 'open');

    // 等待开关门超时时间
    await new Promise(resolve => setTimeout(resolve, this.config.doorTimeout * 1000));

    // 关闭黄灯
    await this.sendToAll(yellowLamps, 'close');

    // 打开绿灯
    await this.sendToAll(greenLamps, 'open');

    // 等待开关门超时时间
    await new Promise(resolve => setTimeout(resolve, this.config.doorRedLampTimeout * 1000));

    // 关闭绿灯
    await this.sendToAll(greenLamps, 'close');
  }

  /**
   * 关门流程：关门->开黄灯->关完成->关黄灯->开绿灯->关绿灯绿灯
   * @returns Promise
   */
  async closeDoors(): Promise<void> {
    await this.open();

    const doors = this.getDoors();
    const yellowLamps = this.getYellowLamps();
    const greenLamps = this.getGreenLamps();

    // 四道门同时关闭
    await this.sendToAll(doors, 'close');

    // 打开黄灯
    await this.sendToAll(yellowLamps, 'open');

    // 等待开关门超时时间
    await new Promise(resolve => setTimeout(resolve, this.config.doorTimeout * 1000));

    // 关闭黄灯
    await this.sendToAll(yellowLamps, 'close');

    // 打开绿灯
    await this.sendToAll(greenLamps, 'open');

    // 等待开关门超时时间
    await new Promise(resolve => setTimeout(resolve, this.config.doorRedLampTimeout * 1000));

    // 关闭绿灯
    await this.sendToAll(greenLamps, 'close');
  }

  /**
   * 检查串口是否打开
   * @returns 串口是否打开
   */
  isPortOpen(): boolean {
    return this.isOpen;
  }
}
