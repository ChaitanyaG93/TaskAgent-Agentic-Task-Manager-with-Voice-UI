// Service worker for caching static assets and providing offline support

const CACHE_NAME = 'agentic-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // network-first for API calls (e.g., hypothetical voice API)
    if (url.pathname.includes('/voice')) {
        event.respondWith(
            fetch(request)
                .then(resp => {
                    const copy = resp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return resp;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // cache-first for navigation and static resources
    event.respondWith(
        caches.match(request).then(cached => {
            return cached || fetch(request).then(resp => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, resp.clone());
                    return resp;
                });
            });
        })
    );
});
    
    const priority = detectPriorityFromCommand(command);
    if (priority) {
        state.currentPriority = priority;
        priorityButtons.forEach(btn => {
            btn.classList.toggle('priority-btn-active', btn.dataset.priority === priority);
        });
        
        const responses = {
            high: AGENT_RESPONSES.PRIORITY_HIGH,
            medium: AGENT_RESPONSES.PRIORITY_MEDIUM,
            low: AGENT_RESPONSES.PRIORITY_LOW
        };
        speak(responses[priority]);
        return;
    }
    
    addTask(command, state.currentPriority);
    speak(getRandomResponse(AGENT_RESPONSES.TASK_ADDED));


function matchesCommand(text, commandArray) {
    return commandArray.some(cmd => text.includes(cmd));
}

function detectPriorityFromCommand(command) {
    if (matchesCommand(command, VOICE_COMMANDS.HIGH)) return 'high';
    if (matchesCommand(command, VOICE_COMMANDS.MEDIUM)) return 'medium';
    if (matchesCommand(command, VOICE_COMMANDS.LOW)) return 'low';
    return null;
}

function extractTaskText(command) {
    const addPrefixes = VOICE_COMMANDS.ADD;
    let taskText = command;
    
    for (const prefix of addPrefixes) {
        if (command.includes(prefix)) {
            taskText = command.split(prefix)[1]?.trim() || command;
            break;
        }
    }
    
    const priorityKeywords = [...VOICE_COMMANDS.HIGH, ...VOICE_COMMANDS.MEDIUM, ...VOICE_COMMANDS.LOW];
    for (const keyword of priorityKeywords) {
        taskText = taskText.replace(keyword, '').trim();
    }
    
    return taskText;
}

function addTaskByVoice(command) {
    const taskText = extractTaskText(command);
    
    if (!taskText) {
        speak("What task would you like to add?");
        return;
    }
    
    const priority = detectPriorityFromCommand(command) || state.currentPriority;
    addTask(taskText, priority);
    speak(getRandomResponse(AGENT_RESPONSES.TASK_ADDED));
}

function completeTaskByVoice(command) {
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    
    if (incompleteTasks.length === 0) {
        speak("You don't have any incomplete tasks. Great job!");
        return;
    }
    
    const numberMatch = command.match(/\d+/);
    if (numberMatch) {
        const index = parseInt(numberMatch[0]) - 1;
        if (index >= 0 && index < incompleteTasks.length) {
            toggleTask(incompleteTasks[index].id);
            speak(getRandomResponse(AGENT_RESPONSES.TASK_COMPLETED));
            return;
        }
    }
    
    const firstIncomplete = incompleteTasks[0];
    const taskWords = command.split(' ').filter(w => !VOICE_COMMANDS.COMPLETE.includes(w));
    const matchingTask = incompleteTasks.find(t => 
        taskWords.some(word => t.text.toLowerCase().includes(word))
    );
    
    if (matchingTask) {
        toggleTask(matchingTask.id);
        speak(getRandomResponse(AGENT_RESPONSES.TASK_COMPLETED));
    } else {
        toggleTask(firstIncomplete.id);
        speak(getRandomResponse(AGENT_RESPONSES.TASK_COMPLETED));
    }
}

function deleteTaskByVoice(command) {
    if (state.tasks.length === 0) {
        speak(AGENT_RESPONSES.NO_TASKS);
        return;
    }
    
    const numberMatch = command.match(/\d+/);
    if (numberMatch) {
        const index = parseInt(numberMatch[0]) - 1;
        if (index >= 0 && index < state.tasks.length) {
            removeTask(state.tasks[index].id);
            speak(getRandomResponse(AGENT_RESPONSES.TASK_DELETED));
            return;
        }
    }
    
    const lastTask = state.tasks[state.tasks.length - 1];
    removeTask(lastTask.id);
    speak(getRandomResponse(AGENT_RESPONSES.TASK_DELETED));
}

function listTasks() {
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    
    if (incompleteTasks.length === 0) {
        speak(AGENT_RESPONSES.NO_TASKS);
        return;
    }
    
    const taskList = incompleteTasks.slice(0, 5).map((t, i) => 
        `${i + 1}. ${t.text}`
    ).join('. ');
    
    const message = `You have ${incompleteTasks.length} task${incompleteTasks.length > 1 ? 's' : ''}. ${taskList}`;
    speak(message);
}

function speak(text) {
    if (!state.soundEnabled || !state.synthesis) return;
    
    state.synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';
    
    const voices = state.synthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) 
                         || voices.find(v => v.lang.startsWith('en'))
                         || voices[0];
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    state.synthesis.speak(utterance);
}

function getRandomResponse(responseArray) {
    if (Array.isArray(responseArray)) {
        return responseArray[Math.floor(Math.random() * responseArray.length)];
    }
    return responseArray;
}

function addTask(text, priority = state.currentPriority) {
    if (!text || text.trim() === '') {
        showNotification('Please enter a task', 'warning');
        return;
    }
    
    const task = new Task(text.trim(), priority);
    state.tasks.push(task);
    renderTask(task);
    updateTaskCounts();
    updateStats();
    updateSuggestions();
    taskInput.value = '';
    showNotification('Task added successfully!', 'success');
    saveTasks();
}

function removeTask(taskId) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;
    
    state.tasks.splice(index, 1);
    
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
        taskElement.classList.add('removing');
        setTimeout(() => {
            taskElement.remove();
            updateTaskCounts();
            updateStats();
            updateSuggestions();
        }, 300);
    }
    
    saveTasks();
}

function toggleTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
        taskElement.classList.toggle('completed');
        const checkbox = taskElement.querySelector('.task-checkbox');
        if (checkbox) {
            checkbox.checked = task.completed;
        }
    }
    
    updateStats();
    updateSuggestions();
    checkAllTasksComplete();
    saveTasks();
}

function renderTask(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.setAttribute('data-task-id', task.id);
    li.setAttribute('data-priority', task.priority);
    
    if (task.completed) {
        li.classList.add('completed');
    }
    
    li.innerHTML = `
        <div class="task-content">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${escapeHtml(task.text)}</span>
        </div>
        <div class="task-actions">
            <button class="task-btn edit-btn" title="Edit task">✏️</button>
            <button class="task-btn delete-btn" title="Delete task">🗑️</button>
        </div>
    `;
    
    const checkbox = li.querySelector('.task-checkbox');
    const deleteBtn = li.querySelector('.delete-btn');
    const editBtn = li.querySelector('.edit-btn');
    
    checkbox.addEventListener('change', () => toggleTask(task.id));
    deleteBtn.addEventListener('click', () => removeTask(task.id));
    editBtn.addEventListener('click', () => editTask(task.id));
    
    const list = getListByPriority(task.priority);
    list.appendChild(li);
    
    setTimeout(() => {
        li.style.animation = 'slideInFade 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }, 10);
}

function renderAllTasks() {
    highPriorityList.innerHTML = '';
    mediumPriorityList.innerHTML = '';
    lowPriorityList.innerHTML = '';
    state.tasks.forEach(task => renderTask(task));
    updateTaskCounts();
    updateStats();
}

function getListByPriority(priority) {
    switch(priority) {
        case 'high': return highPriorityList;
        case 'medium': return mediumPriorityList;
        case 'low': return lowPriorityList;
        default: return mediumPriorityList;
    }
}

function updateTaskCounts() {
    const counts = state.tasks.reduce((acc, task) => {
        if (!task.completed) {
            acc[task.priority] = (acc[task.priority] || 0) + 1;
        }
        return acc;
    }, {});
    
    highCount.textContent = counts.high || 0;
    mediumCount.textContent = counts.medium || 0;
    lowCount.textContent = counts.low || 0;
}

function updateStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    totalTasks.textContent = total;
    completedTasks.textContent = completed;
    completionRate.textContent = `${rate}%`;
}

function updateSuggestions() {
    const suggestions = generateSuggestions();
    suggestionsContent.innerHTML = suggestions.map(suggestion => `
        <div class="suggestion-item">
            <span class="suggestion-icon">${suggestion.icon}</span>
            <p class="suggestion-text">${suggestion.text}</p>
        </div>
    `).join('');
}

function generateSuggestions() {
    const suggestions = [];
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    const completedToday = state.tasks.filter(t => t.completed && isToday(t.completedAt)).length;
    
    if (state.tasks.length === 0) {
        return [{
            icon: '👋',
            text: 'Welcome! Click the microphone or type to add your first task.'
        }];
    }
    
    if (state.voiceEnabled) {
        suggestions.push({
            icon: '🎤',
            text: 'Try saying: "Add task buy groceries" or "Complete first task"'
        });
    }
    
    const highPriorityCount = incompleteTasks.filter(t => t.priority === 'high').length;
    if (highPriorityCount > 0) {
        suggestions.push({
            icon: '🔥',
            text: `You have ${highPriorityCount} high-priority task${highPriorityCount > 1 ? 's' : ''}. Focus on these first!`
        });
    }
    
    if (completedToday > 0) {
        suggestions.push({
            icon: '🎯',
            text: `Great work! You've completed ${completedToday} task${completedToday > 1 ? 's' : ''} today.`
        });
    }
    
    const hour = new Date().getHours();
    if (hour < 12 && incompleteTasks.length > 0) {
        suggestions.push({
            icon: '☀️',
            text: 'Good morning! Start your day by tackling your most important tasks.'
        });
    }
    
    if (suggestions.length === 0) {
        suggestions.push({
            icon: '✨',
            text: 'Keep going! Every completed task brings you closer to your goals.'
        });
    }
    
    return suggestions;
}

voiceBtn.addEventListener('click', () => {
    if (state.isListening) {
        state.recognition.stop();
    } else {
        startListening();
    }
});

addBtn.addEventListener('click', () => {
    addTask(taskInput.value, state.currentPriority);
});

taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask(taskInput.value, state.currentPriority);
    }
});

priorityButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        priorityButtons.forEach(b => b.classList.remove('priority-btn-active'));
        btn.classList.add('priority-btn-active');
        state.currentPriority = btn.getAttribute('data-priority');
    });
});

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

document.getElementById('voiceToggle')?.addEventListener('change', (e) => {
    state.voiceEnabled = e.target.checked;
    if (!state.voiceEnabled && state.isListening) {
        state.recognition.stop();
    }
});

document.getElementById('soundToggle')?.addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isToday(timestamp) {
    const today = new Date();
    const date = new Date(timestamp);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function checkAllTasksComplete() {
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    if (state.tasks.length > 0 && incompleteTasks.length === 0) {
        celebrateCompletion();
    }
}

function celebrateCompletion() {
    celebrationOverlay.classList.add('active');
    speak("Congratulations! You've completed all your tasks!");
    setTimeout(() => {
        celebrationOverlay.classList.remove('active');
    }, 3000);
}

function editTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        const newText = prompt('Edit task:', task.text);
        if (newText && newText.trim() !== '') {
            task.text = newText.trim();
            renderAllTasks();
            saveTasks();
        }
    }
}

function saveTasks() {
    try {
        localStorage.setItem('agentic_tasks', JSON.stringify(state.tasks));
    } catch (error) {
        console.error('Failed to save tasks:', error);
    }    // (added near the top of script.js)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechSynthesis = window.speechSynthesis;
    let recognition = null;
    let recognizing = false;
    let continuousMode = false; // toggle for keeping mic open
    
    function showTextOnlyMode() {
      state.voiceEnabled = false;
      voiceBtn.disabled = true;
      voiceStatus.querySelector('.status-text').textContent = 'Voice unavailable';
      voiceStatus.classList.add('disabled');
    }
    
    function initSpeechRecognition() {
      if (!SpeechRecognition) { showTextOnlyMode(); return; }
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;
      // …handlers defined below…
    }
}

function loadTasks() {
    try {
        const stored = localStorage.getItem('agentic_tasks');
        if (stored) {
            state.tasks = JSON.parse(stored);
            renderAllTasks();
            updateSuggestions();
        }
    } catch (error) {
        console.error('Failed to load tasks:', error);
    }
}

const style = document.createElement('style');
style.textContent = `
    .task-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-md);
        background: var(--bg-tertiary);
        border-radius: var(--radius-md);
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: all var(--transition-base);
        cursor: pointer;
    }
    
    .task-item:hover {
        background: var(--bg-elevated);
        border-color: var(--accent-primary);
        transform: translateX(4px);
    }
    
    .task-item.completed {
        opacity: 0.6;
    }
    
    .task-item.completed .task-text {
        text-decoration: line-through;
        color: var(--text-dim);
    }
    
    .task-item.removing {
        animation: slideOutRight 0.3s ease-out forwards;
    }
    
    @keyframes slideInFade {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .task-content {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex: 1;
    }
    
    .task-checkbox {
        width: 20px;
        height: 20px;
        cursor: pointer;
        accent-color: var(--accent-primary);
    }
    
    .task-text {
        font-size: var(--font-base);
        color: var(--text-primary);
    }
    
    .task-actions {
        display: flex;
        gap: var(--space-xs);
        opacity: 0;
        transition: opacity var(--transition-fast);
    }
    
    .task-item:hover .task-actions {
        opacity: 1;
    }
    
    .task-btn {
        width: 32px;
        height: 32px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-fast);
        font-size: var(--font-sm);
    }
    
    .task-btn:hover {
        background: var(--bg-elevated);
        transform: scale(1.1);
    }
    
    .delete-btn:hover {
        border-color: var(--error);
    }
    
    .edit-btn:hover {
        border-color: var(--info);
    }
    
    .voice-btn.listening {
        animation: voicePulse 1.5s ease-in-out infinite;
        box-shadow: 0 0 30px var(--accent-primary);
    }
    
    @keyframes voicePulse {
        0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 20px var(--accent-primary);
        }
        50% {
            transform: scale(1.05);
            box-shadow: 0 0 40px var(--accent-primary);
        }
    }
`;
document.head.appendChild(style);

function init() {
    const voiceSupported = initVoiceRecognition();
    
    if (voiceSupported) {
        console.log('✓ Voice recognition initialized');
    } else {
        console.warn('⚠ Voice recognition not available');
    }
    
    if (state.synthesis) {
        state.synthesis.onvoiceschanged = () => {
            console.log('✓ Voices loaded:', state.synthesis.getVoices().length);
        };
    }
    
    loadTasks();
    updateSuggestions();
    
    console.log('🚀 Agentic Task Manager - Phase 2 Initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}