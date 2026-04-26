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
