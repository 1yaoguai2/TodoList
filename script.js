// 获取DOM元素
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const modal = document.getElementById('logModal');
const closeBtn = document.querySelector('.close');
const logContent = document.getElementById('logContent');
const filterButtons = document.querySelectorAll('.filter-btn');
let currentFilter = 'all';
let db;

// 初始化数据库
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TodoListDB', 1);

        request.onerror = () => {
            console.error("数据库打开失败");
            reject(request.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("数据库打开成功");
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('TodoListLogs')) {
                db.createObjectStore('TodoListLogs', { keyPath: 'id' });
                console.log("创建存储对象成功");
            }
        };
    });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        loadTasks();
        setupEventListeners();
    } catch (error) {
        console.error("初始化失败:", error);
        alert("初始化存储失败，部分功能可能无法使用");
    }
});

// 设置事件监听器
function setupEventListeners() {
    // 筛选按钮点击事件
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            applyFilter();
        });
    });

    // 回车键添加任务
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    // 关闭弹窗
    closeBtn.onclick = () => {
        modal.style.display = "none";
    };

    // 点击弹窗外部关闭
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
}

// 添加任务
function addTask() {
    const taskText = taskInput.value.trim();
    const taskDesc = document.getElementById('taskDescription').value.trim();

    if (taskText === '') return;

    const task = {
        id: Date.now(),
        text: taskText,
        description: taskDesc,
        completed: false,
        startTime: null,
        endTime: null
    };

    createTaskElement(task);
    saveTasks();

    // 清空输入
    taskInput.value = '';
    document.getElementById('taskDescription').value = '';
}

// 创建任务元素
function createTaskElement(task) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    if (task.completed) li.classList.add('completed');

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const taskText = document.createElement('span');
    taskText.className = 'task-text';
    taskText.textContent = task.text;

    // 如果有描述，添加描述元素
    if (task.description) {
        const descElement = document.createElement('div');
        descElement.className = 'task-description';
        descElement.textContent = `描述：${task.description}`;
        taskContent.appendChild(descElement);
    }

    const timeElement = document.createElement('div');
    timeElement.className = 'task-time';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'task-buttons';

    const startBtn = document.createElement('button');
    startBtn.className = 'start-btn';
    startBtn.textContent = task.startTime ? '完成' : '开始';
    if (task.completed) {
        startBtn.disabled = true;
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '删除';
    deleteBtn.className = 'delete-btn';

    startBtn.addEventListener('click', () => handleTaskAction(li, timeElement, startBtn));
    deleteBtn.addEventListener('click', () => deleteTask(li));

    taskContent.appendChild(taskText);
    taskContent.appendChild(timeElement);
    buttonContainer.appendChild(startBtn);
    buttonContainer.appendChild(deleteBtn);
    li.appendChild(taskContent);
    li.appendChild(buttonContainer);
    taskList.appendChild(li);

    if (task.startTime) {
        updateTimeDisplay(timeElement, task);
    }
}

// 处理任务操作
function handleTaskAction(li, timeElement, button) {
    const tasks = getAllTasks();
    const task = tasks.find(t => t.id === li.dataset.id);
    const taskText = li.querySelector('.task-text').textContent;
    const taskDesc = li.querySelector('.task-description')?.textContent.replace('描述：', '') || '';

    if (!task.startTime) {
        // 开始任务时显示确认弹窗
        const startTime = new Date();
        const confirmMessage = `是否开始以下任务？

任务名称: ${taskText}${taskDesc ? '\n任务描述: ' + taskDesc : ''}
开始时间: ${formatTime(startTime)}`;

        if (confirm(confirmMessage)) {
            const startTimeISO = startTime.toISOString();
            task.startTime = startTimeISO;
            li.dataset.startTime = startTimeISO;
            button.textContent = '完成';

            updateTimeDisplay(timeElement, task);
            saveTasks();
        }
    } else {
        // 完成任务时先提示输入完成描述
        const additionalDesc = prompt("请输入完成时的补充描述（可选）：", taskDesc);

        if (additionalDesc !== null) {  // 用户点击确定
            const startTime = new Date(task.startTime);
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);

            // 处理描述文本，添加括折号
            const finalDesc = taskDesc ? `${taskDesc} —— ${additionalDesc}` : additionalDesc;

            const confirmMessage = `是否完成以下任务？

任务名称: ${taskText}
任务描述: ${finalDesc || '无'}
开始时间: ${formatTime(startTime)}
完成时间: ${formatTime(endTime)}
总用时: ${formatDuration(duration)}`;

            if (confirm(confirmMessage)) {
                const endTimeISO = endTime.toISOString();
                task.endTime = endTimeISO;
                li.dataset.endTime = endTimeISO;
                task.completed = true;
                li.classList.add('completed');
                button.disabled = true;

                // 更新任务描述
                if (finalDesc) {
                    const descElement = li.querySelector('.task-description');
                    if (descElement) {
                        descElement.textContent = `描述：${finalDesc}`;
                    } else {
                        const newDescElement = document.createElement('div');
                        newDescElement.className = 'task-description';
                        newDescElement.textContent = `描述：${finalDesc}`;
                        li.querySelector('.task-content').appendChild(newDescElement);
                    }
                }

                updateTimeDisplay(timeElement, task);
                saveTasks();
                updateProgress();
                applyFilter();
            }
        }
    }
}

// 删除任务
function deleteTask(li) {
    const taskText = li.querySelector('.task-text').textContent;
    const task = getAllTasks().find(t => t.id === li.dataset.id);
    const taskDesc = li.querySelector('.task-description')?.textContent.replace('描述：', '') || '';

    let status = '未开始';
    if (task.completed) {
        status = '已完成';
    } else if (task.startTime) {
        status = '进行中';
    }

    let timeInfo = '';
    if (task.startTime) {
        const startTime = new Date(task.startTime);
        timeInfo = `\n开始时间: ${formatTime(startTime)}`;

        if (task.endTime) {
            const endTime = new Date(task.endTime);
            const duration = Math.round((endTime - startTime) / 1000);
            timeInfo += `\n完成时间: ${formatTime(endTime)}`;
            timeInfo += `\n总用时: ${formatDuration(duration)}`;
        }
    }

    const confirmMessage = `是否确认删除以下任务？\n
任务名称：${taskText}${taskDesc ? '\n任务描述：' + taskDesc : ''}
当前状态：${status}${timeInfo}`;

    if (confirm(confirmMessage)) {
        li.remove();
        saveTasks();
        updateProgress();
        applyFilter();
    }
}

// 更新时间显示
function updateTimeDisplay(element, task) {
    let timeText = '';
    if (task.startTime) {
        const startTime = new Date(task.startTime);
        timeText = `开始: ${formatTime(startTime)}`;

        if (task.endTime) {
            const endTime = new Date(task.endTime);
            const duration = Math.round((endTime - startTime) / 1000);
            timeText += ` | 完成: ${formatTime(endTime)} | 用时: ${formatDuration(duration)}`;
        }
    }
    element.textContent = timeText;
}

// 保存任务到localStorage
function saveTasks() {
    const tasks = [];
    document.querySelectorAll('#taskList li').forEach(li => {
        const timeElement = li.querySelector('.task-time');
        const taskText = li.querySelector('.task-text');
        const taskDesc = li.querySelector('.task-description')?.textContent.replace('描述：', '') || '';
        const task = {
            id: li.dataset.id,
            text: taskText.textContent,
            description: taskDesc,
            completed: li.classList.contains('completed'),
            startTime: li.dataset.startTime || null,
            endTime: li.dataset.endTime || null
        };
        tasks.push(task);

        if (task.completed && task.endTime) {
            saveTaskLog(task);
        }
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// 从localStorage加载任务
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks.forEach(task => createTaskElement(task));
    updateProgress();
}

// 更新进度显示
function updateProgress() {
    const totalTasks = document.querySelectorAll('#taskList li').length;
    const completedTasks = document.querySelectorAll('#taskList li.completed').length;

    progressText.textContent = `${completedTasks}/${totalTasks}`;
    const percentage = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
    progressFill.style.width = `${percentage}%`;
}

// 应用筛选
function applyFilter() {
    const tasks = document.querySelectorAll('#taskList li');

    tasks.forEach(task => {
        switch (currentFilter) {
            case 'all':
                task.style.display = '';
                break;
            case 'completed':
                task.style.display = task.classList.contains('completed') ? '' : 'none';
                break;
            case 'uncompleted':
                task.style.display = !task.classList.contains('completed') ? '' : 'none';
                break;
        }
    });
}

// 获取所有任务
function getAllTasks() {
    const tasks = [];
    document.querySelectorAll('#taskList li').forEach(li => {
        tasks.push({
            id: li.dataset.id,
            text: li.querySelector('.task-text').textContent,
            description: li.querySelector('.task-description')?.textContent.replace('描述：', '') || '',
            completed: li.classList.contains('completed'),
            startTime: li.dataset.startTime || null,
            endTime: li.dataset.endTime || null
        });
    });
    return tasks;
}

// 保存任务日志
function saveTaskLog(task) {
    const transaction = db.transaction(['TodoListLogs'], 'readwrite');
    const store = transaction.objectStore('TodoListLogs');

    const log = {
        id: `${task.id}_log`,
        taskId: task.id,
        text: task.text,
        description: task.description,
        startTime: task.startTime,
        endTime: task.endTime,
        duration: calculateDuration(task.startTime, task.endTime),
        timestamp: new Date().toISOString()
    };

    store.put(log);
}

// 获取所有日志
function getAllLogs() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['TodoListLogs'], 'readonly');
        const store = transaction.objectStore('TodoListLogs');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 查看日志
async function viewLogs() {
    try {
        // 设置日期选择器的默认值为最近一个月
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);

        document.getElementById('startDate').valueAsDate = startDate;
        document.getElementById('endDate').valueAsDate = endDate;

        // 显示日志
        await filterLogs();
        modal.style.display = "block";
    } catch (error) {
        console.error("获取日志失败:", error);
        alert("获取日志失败，请稍后重试");
    }
}

// 筛选日志
async function filterLogs() {
    try {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        endDate.setHours(23, 59, 59, 999); // 设置为当天最后一毫秒

        const logs = await getAllLogs();
        let filteredLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= startDate && logDate <= endDate;
        });

        let logText = '';

        if (filteredLogs.length === 0) {
            logText = '所选时间范围内暂无完成的任务记录';
        } else {
            // 按时间戳降序排序
            filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // 添加时间范围信息
            logText = `时间范围：${startDate.toLocaleDateString()} 至 ${endDate.toLocaleDateString()}\n`;
            logText += `共找到 ${filteredLogs.length} 条记录\n`;
            logText += '------------------------\n\n';

            // 从最新的日志开始，反向编号
            const totalLogs = filteredLogs.length;
            filteredLogs.forEach((log, index) => {
                logText += `任务 ${totalLogs - index}:\n`;
                logText += `任务名称: ${log.text}\n`;
                if (log.description) {
                    logText += `任务描述: ${log.description}\n`;
                }
                logText += `开始时间: ${formatTime(new Date(log.startTime))}\n`;
                logText += `完成时间: ${formatTime(new Date(log.endTime))}\n`;
                logText += `用时: ${formatDuration(log.duration)}\n`;
                logText += `记录时间: ${new Date(log.timestamp).toLocaleString()}\n`;
                logText += '------------------------\n';
            });
        }

        logContent.textContent = logText;
    } catch (error) {
        console.error("筛选日志失败:", error);
        alert("筛选日志失败，请稍后重试");
    }
}

// 复制日志
function copyLogs() {
    const logText = logContent.textContent;
    navigator.clipboard.writeText(logText).then(() => {
        alert("日志已复制到剪贴板");
    }).catch(err => {
        console.error('复制失败:', err);
        alert("复制失败，请手动复制");
    });
}

// 清空日志
function clearLogs() {
    if (confirm('确定要清空所有日志吗？此操作不可恢复。')) {
        const transaction = db.transaction(['TodoListLogs'], 'readwrite');
        const store = transaction.objectStore('TodoListLogs');
        const request = store.clear();

        request.onsuccess = () => {
            alert('日志已清空');
            logContent.textContent = '暂无完成的任务记录';
        };

        request.onerror = () => {
            console.error("清空日志失败:", request.error);
            alert("清空日志失败，请稍后重试");
        };
    }
}

// 格式化时间
function formatTime(date) {
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 格式化持续时间
function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分${seconds % 60}秒`;
}

// 计算持续时间
function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    return Math.round((new Date(endTime) - new Date(startTime)) / 1000);
}

// 将函数添加到window对象，使其可以从HTML中直接调用
window.addTask = addTask;
window.viewLogs = viewLogs;
window.filterLogs = filterLogs;
window.copyLogs = copyLogs;
window.clearLogs = clearLogs;