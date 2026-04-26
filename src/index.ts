import { SerialPortDriver } from "./drivers/serialport";
import type { DriveSerialPort } from "./types/drive_types";

/**
 * 导出DriveSerialPort接口
 */
export type { DriveSerialPort } from "./types/drive_types";

/**
 * 导出SerialPortDriver类
 */
export { SerialPortDriver } from "./drivers/serialport";

/**
 * 自动化门控制SDK类
 */
export class AutomationDoorSdk {
  /** 串口驱动实例 */
  private readonly driver: SerialPortDriver;

  /**
   * 构造函数
   * @param config 串口配置
   */
  constructor(config: DriveSerialPort) {
    this.driver = new SerialPortDriver(config);
  }

  /**
   * 执行开门流程
   * @returns Promise
   */
  async openDoors(): Promise<void> {
    return this.driver.openDoors();
  }

  /**
   * 执行关门流程
   * @returns Promise
   */
  async closeDoors(): Promise<void> {
    return this.driver.closeDoors();
  }

  /**
   * 打开串口连接
   * @returns Promise
   */
  async open(): Promise<void> {
    return this.driver.open();
  }

  /**
   * 关闭串口连接
   * @returns Promise
   */
  async close(): Promise<void> {
    return this.driver.close();
  }

  /**
   * 检查串口是否打开
   * @returns 串口是否打开
   */
  isPortOpen(): boolean {
    return this.driver.isPortOpen();
  }
}