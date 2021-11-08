"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TaskRunner {
    constructor(tasks, interval) {
        if (!tasks || tasks.length === 0) {
            throw new Error('No tasks provided');
        }
        this.tasks = tasks;
        this.interval = interval;
    }
    scheduleTasks(tasks) {
        return this.tasks.push(...tasks);
    }
    start() {
        this.handle = setInterval(() => this.runNextTask(this.tasks).next(), this.interval);
    }
    stop() {
        clearInterval(this.handle);
    }
    *runNextTask(tasks) {
        let idx = 0;
        while (true) {
            yield tasks[idx++]();
        }
    }
}
exports.default = TaskRunner;
//# sourceMappingURL=task-runner.js.map