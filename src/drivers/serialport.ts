import {SerialPort} from 'serialport';
import {CommandItem, DriveConfig, DriveSerialPort, Logger} from '../types/drive_types';

/**
 * 串口驱动类，负责与硬件设备的串口通信
 * 适配协议：9A开/9B关/9C机器人，异或校验码自动计算
 * 协议规则：
 * 1. 门/灯 5字节：前4字节异或 = 第5位校验码
 * 2. 机器人 4字节：前3字节异或 = 第4位校验码
 * 3. 执行流程严格对齐现场日志时序
 */
export class SerialPortDriver {
    /** 串口实例 */
    private port: SerialPort | null = null;
    /** 串口是否打开 */
    private isOpen: boolean = false;
    /** 串口配置 */
    private serialPort: DriveSerialPort;
    /** 命令列表，从配置文件加载 */
    private commandList: CommandItem[];
    /** 单条指令发送间隔(ms) */
    private readonly writeInterval: number;

    constructor(config: DriveConfig, private logger?: Logger) {
        this.serialPort = config.serialPort;
        this.commandList = config.door.commands || [];
        this.writeInterval = this.serialPort.serialWriteTimeInterval || 100;
        this.log(`SerialPortDriver initialized with config: ${JSON.stringify(config)}`);
    }

    /**
     * 打开串口连接
     * @returns Promise
     */
    async open(): Promise<void> {
        if (this.isOpen) {
            this.log('Serial port is already open, skipping open');
            return;
        }

        this.log(`Opening serial port: ${this.serialPort.doorCOM} at ${this.serialPort.doorBaudRate} baud`);

        return new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: this.serialPort.doorCOM,
                baudRate: this.serialPort.doorBaudRate
            }, (err): void => {
                if (err) {
                    this.log(`Failed to open serial port: ${err.message}`);
                    reject(new Error(`无法打开串口 ${this.serialPort.doorCOM}: ${err.message}`));
                } else {
                    this.isOpen = true;
                    this.log(`Serial port ${this.serialPort.doorCOM} opened successfully`);
                    resolve();
                }
            });
        });
    }

    /**
     * 关闭串口连接
     * @returns Promise
     */
    async close(): Promise<void> {
        if (!this.isOpen) {
            this.log('Serial port is already closed, skipping close');
            return;
        }

        this.log(`Closing serial port: ${this.serialPort.doorCOM}`);

        return new Promise((resolve, reject) => {
            if (!this.port || !this.isOpen) {
                resolve();
                return;
            }

            this.port.close((err) => {
                if (err) {
                    this.log(`Failed to close serial port: ${err.message}`);
                    reject(err);
                } else {
                    this.isOpen = false;
                    this.port = null;
                    this.log(`Serial port ${this.serialPort.doorCOM} closed successfully`);
                    resolve();
                }
            });
        });
    }

    /**
     * 开门流程【严格对齐现场日志时序】
     * 日志时序：触发开门 → 先亮黄灯 → 再开门 + 启动机器人 → 延时 → 灭黄灯 → 亮绿灯 → 延时 → 灭绿灯
     */
    async openDoors(): Promise<void> {
        this.log('========== 开始执行开门流程 ==========');
        await this.open();

        const doors = this.getDoors();
        const yellowLamps = this.getYellowLamps();
        const greenLamps = this.getGreenLamps();
        // const robots = this.getRobots();

        // 1. 优先打开所有黄灯
        this.log('步骤1：开启所有黄灯');
        await this.sendDeviceBatch(yellowLamps, 'open', '黄灯');

        // 2. 开启所有门 + 启动机器人
        this.log('步骤2：开启所有门设备');
        await this.sendDeviceBatch(doors, 'open', '门禁');
        this.log('步骤3：启动机器人');
        // await this.sendDeviceBatch(robots, 'open', '机器人');

        // 3. 等待开门完成延时
        const doorWaitMs = this.serialPort.doorTimeout * 1000;
        this.log(`步骤4：等待开门就位 ${this.serialPort.doorTimeout} 秒`);
        await new Promise(resolve => setTimeout(resolve, doorWaitMs));

        // 4. 关闭黄灯
        this.log('步骤5：关闭所有黄灯');
        await this.sendDeviceBatch(yellowLamps, 'close', '黄灯');

        // 5. 开门完成亮绿灯
        this.log('步骤6：开启完成提示绿灯');
        await this.sendDeviceBatch(greenLamps, 'open', '绿灯');

        // 6. 绿灯保持延时
        const lampWaitMs = this.serialPort.doorRedLampTimeout * 1000;
        this.log(`步骤7：绿灯保持时长 ${this.serialPort.doorRedLampTimeout} 秒`);
        await new Promise(resolve => setTimeout(resolve, lampWaitMs));

        // 7. 关闭绿灯
        this.log('步骤8：关闭提示绿灯');
        await this.sendDeviceBatch(greenLamps, 'close', '绿灯');

        this.log('========== 开门流程执行完成 ==========');
    }

    /**
     * 关门流程【对齐现场日志时序】
     * 触发关门 → 亮黄灯 → 关门 → 延时 → 灭黄灯 → 亮绿灯 → 延时 → 灭绿灯
     */
    async closeDoors(): Promise<void> {
        this.log('========== 开始执行关门流程 ==========');
        await this.open();

        const doors = this.getDoors();
        const yellowLamps = this.getYellowLamps();
        const greenLamps = this.getGreenLamps();
        // const robots = this.getRobots();

        // 1. 先开黄灯
        this.log('步骤1：开启所有黄灯');
        await this.sendDeviceBatch(yellowLamps, 'open', '黄灯');

        // 2. 关闭所有门 + 停止机器人
        this.log('步骤2：关闭所有门禁');
        await this.sendDeviceBatch(doors, 'close', '门禁');
        this.log('步骤3：停止机器人');
        // await this.sendDeviceBatch(robots, 'close', '机器人');

        // 3. 关门就位等待
        const doorWaitMs = this.serialPort.doorTimeout * 1000;
        this.log(`步骤4：等待关门就位 ${this.serialPort.doorTimeout} 秒`);
        await new Promise(resolve => setTimeout(resolve, doorWaitMs));

        // 4. 关闭黄灯
        this.log('步骤5：关闭所有黄灯');
        await this.sendDeviceBatch(yellowLamps, 'close', '黄灯');

        // 5. 关门完成亮绿灯
        this.log('步骤6：开启完成提示绿灯');
        await this.sendDeviceBatch(greenLamps, 'open', '绿灯');

        // 6. 绿灯延时
        const lampWaitMs = this.serialPort.doorRedLampTimeout * 1000;
        this.log(`步骤7：绿灯保持时长 ${this.serialPort.doorRedLampTimeout} 秒`);
        await new Promise(resolve => setTimeout(resolve, lampWaitMs));

        // 7. 关闭绿灯
        this.log('步骤8：关闭提示绿灯');
        await this.sendDeviceBatch(greenLamps, 'close', '绿灯');

        this.log('========== 关门流程执行完成 ==========');
    }

    /**
     * 查询串口状态
     */
    isPortOpen(): boolean {
        return this.isOpen;
    }

    private log(...args: any[]): void {
        if (this.logger) {
            this.logger.debug('SerialPortDriver:', ...args);
        }
    }

    /**
     * 5字节门/灯指令 异或校验计算（安全版，无TS报错）
     */
    private calc5ByteChecksum(bytes: number[]): number {
        const b0 = bytes[0] ?? 0;
        const b1 = bytes[1] ?? 0;
        const b2 = bytes[2] ?? 0;
        const b3 = bytes[3] ?? 0;
        return b0 ^ b1 ^ b2 ^ b3;
    }

    /**
     * 4字节机器人指令 异或校验计算（安全版，无TS报错）
     */
    private calc4ByteChecksum(bytes: number[]): number {
        const b0 = bytes[0] ?? 0;
        const b1 = bytes[1] ?? 0;
        const b2 = bytes[2] ?? 0;
        return b0 ^ b1 ^ b2;
    }

    /**
     * 自动修正指令最后一位校验码
     * @param hexStr 原始带空格十六进制指令
     * @returns 补齐正确校验码的指令
     */
    private autoFixChecksum(hexStr: string): string {
        const pureHex = hexStr.replace(/\s+/g, '');
        if (!pureHex) return hexStr;

        // 转字节数组
        const byteArr: number[] = [];
        for (let i = 0; i < pureHex.length; i += 2) {
            byteArr.push(parseInt(pureHex.substr(i, 2), 16));
        }

        // 5字节 门/灯
        if (byteArr.length === 5) {
            const check = this.calc5ByteChecksum(byteArr.slice(0, 4));
            byteArr[4] = check;
        }
        // 4字节 机器人
        else if (byteArr.length === 4) {
            const check = this.calc4ByteChecksum(byteArr.slice(0, 3));
            byteArr[3] = check;
        }

        // 转回带空格十六进制字符串
        return byteArr.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
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
     * 发送单条串口指令（自动补校验码）
     */
    private async writeCommand(hexCommand: string, deviceName: string = 'Unknown', action: string = 'execute'): Promise<void> {
        if (!this.port || !this.isOpen) {
            const errorMsg = 'Serial port is not open';
            this.log(errorMsg);
            throw new Error(errorMsg);
        }

        // 自动重算校验码
        const realCmd = this.autoFixChecksum(hexCommand);
        this.log(`[校验修正] 原始:${hexCommand} 最终:${realCmd}`);
        this.log(`Sending command: ${realCmd} to ${deviceName} ${action}`);

        return new Promise((resolve, reject) => {
            const buffer = this.hexStringToBuffer(realCmd);
            this.port!.write(buffer, (err) => {
                if (err) {
                    this.log(`Failed to write command: ${err.message}`);
                    reject(err);
                    return;
                }
                this.log(`Command sent successfully`);
                setTimeout(resolve, this.writeInterval);
            });
        });
    }

    /**
     * 获取所有门设备
     */
    private getDoors(): CommandItem[] {
        return this.commandList.filter(item => item.category === 'door');
    }

    /**
     * 获取所有黄灯
     */
    private getYellowLamps(): CommandItem[] {
        return this.commandList.filter(item => item.category === 'lamp' && item.color === 'yellow');
    }

    /**
     * 获取所有绿灯
     */
    private getGreenLamps(): CommandItem[] {
        return this.commandList.filter(item => item.category === 'lamp' && item.color === 'green');
    }

    /**
     * 获取机器人设备
     */
    /*
    private getRobots(): CommandItem[] {
        return commandList.filter(item => item.category === 'robot');
    }*/

    /**
     * 顺序逐个发送设备指令（禁止并发，防串口粘包丢包）
     */
    private async sendDeviceBatch(items: CommandItem[], cmdType: 'open' | 'close', desc: string): Promise<void> {
        const actionTxt = cmdType === 'open' ? '开启' : '关闭';
        this.log(`开始${actionTxt}${desc}，共${items.length}台`);
        for (const item of items) {
            const cmd = cmdType === 'open' ? item.open : item.close;
            await this.writeCommand(cmd, `${desc}-${item.id}`, actionTxt);
        }
        this.log(`${actionTxt}${desc}完成`);
    }
}
