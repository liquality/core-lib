declare type Task = () => boolean;
export interface TaskRunnerI<T> {
    scheduleTasks: (tasks: T[]) => number;
    start: () => void;
    stop: () => void;
}
declare class TaskRunner implements TaskRunnerI<Task> {
    tasks: Task[];
    interval: number;
    handle: any;
    constructor(tasks: Task[], interval: number);
    scheduleTasks(tasks: Task[]): number;
    start(): void;
    stop(): void;
    private runNextTask;
}
export default TaskRunner;
