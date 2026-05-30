export interface DriveConfig {
    /**
     * 串口配置
     */
    serialPort: DriveSerialPort;
    /**
     * 门配置
     */
    door: DriveDoor;
    /**
     * 日志配置
     */
    logger?: Logger;
}

/**
 * 门配置类，定义了门的命令项
 */
export class DriveDoor {
    /** 门命令项列表 */
    commands: CommandItem[] | undefined;
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

/**
 * 串口配置
 */
export interface DriveSerialPort {
    /**
     * 串口COM口
     */
    doorCOM: string;
    /**
     * 波特率
     */
    doorBaudRate: number;
    /**
     * 等待开关门超时时间单位是秒
     */
    doorTimeout: number;
    /**
     * 红灯显示超时时间单位是秒
     */
    doorRedLampTimeout: number;
    /**
     * 发送指令间隔时间，单位毫秒，默认为0.1秒，即100毫秒
     */
    serialWriteTimeInterval: number;
}

export interface Logger {
    debug(...args: any[]): void;
}
