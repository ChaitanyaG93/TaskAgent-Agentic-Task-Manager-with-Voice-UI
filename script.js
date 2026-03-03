const state = {
    tasks: [],
    currentPriority: 'medium',
    voiceEnabled: true,
    soundEnabled: true,
    darkMode: true
};

// --------------------------------------------------
// Phase 2: Voice Interface Integration
// --------------------------------------------------

// Web Speech API feature detection
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechSynthesis = window.speechSynthesis;
let recognition = null;
let recognizing = false;
let continuousMode = false; // toggle for keeping mic open

// Voice command definitions (keywords may appear anywhere in utterance)
const VOICE_COMMANDS = {
    ADD_TASK: ['add task', 'create task', 'new task', 'remember to', 'remind me to'],
    MARK_DONE: ['complete', 'done', 'finish', 'check off', 'checked off'],
    DELETE: ['delete', 'remove', 'cancel', 'discard'],
    PRIORITY: ['high priority', 'urgent', 'important', 'low priority'],
    LIST: ['show tasks', 'what do i have', 'list tasks', 'read tasks'],
    HELP: ['help', 'what can you do', 'commands', 'assistance']
};

const AGENT_RESPONSES = {
    TASK_ADDED: [
        "Got it! I've added that to your list.",
        "Task saved. You're on a roll!",
        "Added! Anything else?"
    ],
    TASK_COMPLETED: [
        "Nice work! Task completed.",
        "Checked off! Keep going!",
        "Done! You're making progress."
    ],
    PRIORITY_SET: {
        high: "Marked as high priority. I'll keep this at the top.",
        medium: "Got it, medium priority.",
        low: "Added to your low priority list."
    }
};

function getPreferredVoice() {
    // use first available; more complex preference logic could go here
    const voices = SpeechSynthesis.getVoices();
    return voices.length ? voices[0] : null;
}

function speak(text) {
    if (!SpeechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    const voice = getPreferredVoice();
    if (voice) utterance.voice = voice;
    SpeechSynthesis.speak(utterance);
}

function showTextOnlyMode() {
    state.voiceEnabled = false;
    voiceBtn.disabled = true;
    voiceStatus.querySelector('.status-text').textContent = 'Voice unavailable';
    voiceStatus.classList.add('disabled');
}

function initSpeechRecognition() {
    if (!SpeechRecognition) {
        showTextOnlyMode();
        return;
    }

    recognition = new SpeechRecognition();
    // apply current settings
    recognition.lang = langSelect ? langSelect.value : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    continuousMode = continuousToggle ? continuousToggle.checked : false;
    wakeWord = wakeWordInput ? wakeWordInput.value.trim().toLowerCase() : '';

    recognition.onstart = () => {
        recognizing = true;
        updateVoiceUI('listening');
        transcriptText.textContent = 'Listening...';
    };

    recognition.onend = () => {
        recognizing = false;
        updateVoiceUI('idle');
        transcriptText.textContent = '';
        if (continuousMode) {
            // restart automatically if continuous mode
            recognition.start();
        }
    };

    recognition.onerror = (e) => {
        console.error('Speech recognition error', e);
        transcriptText.textContent = 'Error: ' + e.error;
        updateVoiceUI('error');
    };

    recognition.onresult = (event) => {
        let interim = '';
        let finalTranscript = '';
        let lastConfidence = 0;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
                lastConfidence = event.results[i][0].confidence;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        transcriptText.textContent = interim || finalTranscript;
        updateConfidence(lastConfidence);
        if (finalTranscript) {
            let text = finalTranscript.trim();
            if (wakeWord && wakeWord.length) {
                const lower = text.toLowerCase();
                if (!lower.includes(wakeWord)) {
                    return; // ignore until wake word heard
                }
                // strip wake word
                text = lower.replace(wakeWord, '').trim();
            }
            handleVoiceCommand(text);
        }
    };
}

function updateVoiceUI(stateStr) {
    voiceBtn.classList.remove('listening', 'processing');
    switch (stateStr) {
        case 'listening':
            voiceBtn.classList.add('listening');
            voiceStatus.querySelector('.status-text').textContent = 'Listening';
            voiceTranscript.style.display = 'flex';
            break;
        case 'processing':
            voiceBtn.classList.add('processing');
            voiceStatus.querySelector('.status-text').textContent = 'Processing';
            break;
        default:
            voiceStatus.querySelector('.status-text').textContent = 'Ready';
            voiceTranscript.style.display = 'none';
            transcriptText.textContent = '';
            break;
    }
}

function parseCommand(text) {
    const lowered = text.toLowerCase();
    const result = {action: null, data: null};
    // check ADD_TASK first
    if (VOICE_COMMANDS.ADD_TASK.some(k => lowered.includes(k))) {
        result.action = 'add';
        // remove any keyword from phrase
        let taskText = lowered;
        VOICE_COMMANDS.ADD_TASK.forEach(k => {
            taskText = taskText.replace(k, '');
        });
        // check priority keywords
        let priority = 'medium';
        if (lowered.includes('high priority') || lowered.includes('urgent') || lowered.includes('important')) {
            priority = 'high';
        } else if (lowered.includes('low priority')) {
            priority = 'low';
        }
        result.data = {text: taskText.trim(), priority};
        return result;
    }
    // mark done
    if (VOICE_COMMANDS.MARK_DONE.some(k => lowered.includes(k))) {
        result.action = 'complete';
        // attempt to grab task description after keyword
        const phrase = VOICE_COMMANDS.MARK_DONE.find(k => lowered.includes(k));
        const remainder = lowered.split(phrase)[1] || '';
        result.data = {text: remainder.trim()};
        return result;
    }
    // delete
    if (VOICE_COMMANDS.DELETE.some(k => lowered.includes(k))) {
        result.action = 'delete';
        const phrase = VOICE_COMMANDS.DELETE.find(k => lowered.includes(k));
        const remainder = lowered.split(phrase)[1] || '';
        result.data = {text: remainder.trim()};
        return result;
    }
    // list
    if (VOICE_COMMANDS.LIST.some(k => lowered.includes(k))) {
        result.action = 'list';
        return result;
    }
    // help
    if (VOICE_COMMANDS.HELP.some(k => lowered.includes(k))) {
        result.action = 'help';
        return result;
    }
    return result;
}

function handleVoiceCommand(transcript) {
    updateVoiceUI('processing');
    const cmd = parseCommand(transcript);
    switch (cmd.action) {
        case 'add':
            if (cmd.data && cmd.data.text) {
                addTask(cmd.data.text, cmd.data.priority);
                const response = AGENT_RESPONSES.TASK_ADDED[Math.floor(Math.random() * AGENT_RESPONSES.TASK_ADDED.length)];
                speak(response);
            }
            break;
        case 'complete':
            // simple matching: find first incomplete task containing text
            if (cmd.data && cmd.data.text) {
                const t = state.tasks.find(t => !t.completed && t.text.toLowerCase().includes(cmd.data.text));
                if (t) {
                    toggleTask(t.id);
                    const resp = AGENT_RESPONSES.TASK_COMPLETED[Math.floor(Math.random() * AGENT_RESPONSES.TASK_COMPLETED.length)];
                    speak(resp);
                }
            }
            break;
        case 'delete':
            if (cmd.data && cmd.data.text) {
                const t = state.tasks.find(t => t.text.toLowerCase().includes(cmd.data.text));
                if (t) removeTask(t.id);
            }
            break;
        case 'list':
            let listText = 'Here are your tasks: ' + state.tasks.map(t => (t.completed ? '✓ ' : '') + t.text).join('; ');
            speak(listText);
            break;
        case 'help':
            speak('You can say things like add task buy milk, mark done laundry, delete task grocery, or list tasks.');
            break;
        default:
            // no action
            break;
    }
    setTimeout(() => updateVoiceUI('idle'), 300);
}



let taskIdCounter = 0;

const voiceBtn = document.getElementById('voiceBtn');
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const voiceTranscript = document.getElementById('voiceTranscript');
const transcriptText = document.getElementById('transcriptText');
const voiceStatus = document.getElementById('voiceStatus');
const priorityButtons = document.querySelectorAll('.priority-btn');
const highPriorityList = document.getElementById('highPriorityList');
const mediumPriorityList = document.getElementById('mediumPriorityList');
const lowPriorityList = document.getElementById('lowPriorityList');
const highCount = document.getElementById('highCount');
const mediumCount = document.getElementById('mediumCount');
const lowCount = document.getElementById('lowCount');
const totalTasks = document.getElementById('totalTasks');
const completedTasks = document.getElementById('completedTasks');
const completionRate = document.getElementById('completionRate');
const suggestionsContent = document.getElementById('suggestionsContent');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.getElementById('closeModal');
const celebrationOverlay = document.getElementById('celebrationOverlay');

// settings inputs
const voiceToggle = document.getElementById('voiceToggle');
const continuousToggle = document.getElementById('continuousToggle');
const wakeWordInput = document.getElementById('wakeWordInput');
const langSelect = document.getElementById('langSelect');

let wakeWord = '';

class Task {
    constructor(text, priority = 'medium') {
        this.id = `task_${Date.now()}_${taskIdCounter++}`;
        this.text = text;
        this.priority = priority;
        this.completed = false;
        this.createdAt = Date.now();
        this.completedAt = null;
    }
}

function addTask(text, priority = state.currentPriority) {
    if (!text || text.trim() === '') {
        showNotification('Please enter a task', 'warning');
        return;
    }

    showLoadingSkeleton();

    const trimmed = text.trim();
    if (priority === state.currentPriority) {
        priority = detectPriority(trimmed);
    }

    const task = new Task(trimmed, priority);
    const { category, confidence } = categorizeTask(trimmed);
    task.category = category;
    task.categoryConfidence = confidence;

    state.tasks.push(task);
    state.tasks = smartSort(state.tasks);

    // mimic network delay for effect
    setTimeout(() => {
        renderAllTasks();
        updateTaskCounts();
        updateStats();
        updateSuggestions();
        taskInput.value = '';
        showNotification('Task added successfully!', 'success');
        saveTasks();
    }, 300);
}

function showLoadingSkeleton(count = 3) {
    const target = document.querySelector('.tasks-container');
    if (!target) return;
    for (let i = 0; i < count; i++) {
        const sk = document.createElement('div');
        sk.className = 'task-skeleton';
        target.appendChild(sk);
        setTimeout(() => sk.remove(), 600);
    }
}

// export/import helpers
function exportTasks() {
    const data = {
        tasks: JSON.parse(localStorage.getItem('agentic_tasks')) || [],
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `tasks_backup_${Date.now()}.json`);
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importTasks(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.tasks && Array.isArray(imported.tasks)) {
                state.tasks = imported.tasks;
                renderAllTasks();
                updateSuggestions();
                saveTasks();
                showNotification('Tasks imported successfully!', 'success');
            }
        } catch (err) {
            showNotification('Failed to import tasks.', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
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
    li.style.position = 'relative';

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

    // swipe gesture state
    let touchStartX = 0;
    li.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        // start long-press timer
        li._longPressTimer = setTimeout(() => {
            editTask(task.id);
        }, 600);
    });
    li.addEventListener('touchmove', () => {
        // cancel long press if moved
        clearTimeout(li._longPressTimer);
    });
    li.addEventListener('touchend', e => {
        clearTimeout(li._longPressTimer);
        const touchEndX = e.changedTouches[0].screenX;
        const swipeDistance = touchEndX - touchStartX;
        if (swipeDistance > 100) {
            completeTaskWithAnimation(task, li);
        } else if (swipeDistance < -100) {
            deleteTaskWithAnimation(task.id, li);
        }
    });

    const list = getListByPriority(task.priority);
    list.appendChild(li);

    setTimeout(() => {
        li.style.animation = 'slideInFade 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }, 10);
}


function completeTaskWithAnimation(task, element) {
    element.classList.add('ripple-green','swiped');
    element.style.transform = 'translateX(20px)';
    element.style.opacity = '0.6';
    setTimeout(() => {
        toggleTask(task.id);
        element.classList.remove('ripple-green','swiped');
        element.style.transform = '';
        element.style.opacity = '';
    }, 300);
}

function deleteTaskWithAnimation(taskId, element) {
    element.classList.add('ripple-red');
    element.style.transform = 'translateX(-100%)';
    setTimeout(() => {
        removeTask(taskId);
    }, 300);
}

function renderAllTasks() {
    highPriorityList.innerHTML = '';
    mediumPriorityList.innerHTML = '';
    lowPriorityList.innerHTML = '';

    // sort overall by priority order then smart criteria
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    state.tasks.sort((a, b) => {
        if (a.priority !== b.priority) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // same priority – fall back to smartSort's rules
        return smartSort([a, b])[0] === a ? -1 : 1;
    });

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

// ----------------------------
// Phase 3: Agentic Intelligence
// ----------------------------

// 3.1 Priority detection (lite NLP)
function detectPriority(taskText) {
    const highPriorityKeywords = [
        'urgent', 'asap', 'critical', 'important', 'deadline',
        'today', 'now', 'immediately'
    ];
    const lowPriorityKeywords = [
        'someday', 'maybe', 'eventually', 'when i can',
        'if possible', 'nice to have'
    ];
    const textLower = taskText.toLowerCase();
    if (highPriorityKeywords.some(w => textLower.includes(w))) {
        return 'high';
    }
    if (lowPriorityKeywords.some(w => textLower.includes(w))) {
        return 'low';
    }
    return 'medium';
}

// 3.2 Task categorization
const TASK_CATEGORIES = {
    WORK: ['meeting', 'email', 'call', 'report', 'presentation'],
    PERSONAL: ['grocery', 'workout', 'doctor', 'clean', 'laundry'],
    LEARNING: ['read', 'study', 'course', 'practice', 'learn'],
    ERRANDS: ['buy', 'pick up', 'drop off', 'mail', 'bank']
};

function categorizeTask(taskText) {
    const textLower = taskText.toLowerCase();
    let bestMatch = { category: 'OTHER', confidence: 0 };
    Object.entries(TASK_CATEGORIES).forEach(([cat, keywords]) => {
        keywords.forEach(word => {
            if (textLower.includes(word)) {
                bestMatch = { category: cat, confidence: Math.max(bestMatch.confidence, 1 / keywords.length) };
            }
        });
    });
    return bestMatch; // {category, confidence}
}

// 3.4 Smart ordering
function smartSort(tasks) {
    return tasks.sort((a, b) => {
        // 1. Deadline proximity (earliest first)
        if (a.deadline && b.deadline) {
            return a.deadline - b.deadline;
        }
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        // 2. Estimated duration (short first)
        if (a.estimatedMinutes && b.estimatedMinutes) {
            return a.estimatedMinutes - b.estimatedMinutes;
        }
        // 3. creation time (oldest first)
        return a.createdAt - b.createdAt;
    });
}

// enhanced suggestions using intelligence
function generateSuggestions() {
    const suggestions = [];
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    const completedToday = state.tasks.filter(t => t.completed && isToday(t.completedAt)).length;

    if (state.tasks.length === 0) {
        return [{
            icon: '👋',
            text: 'Welcome! Start by adding your first task using voice or text.'
        }];
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
    if (hour < 10 && incompleteTasks.length > 0) {
        suggestions.push({
            icon: '☀️',
            text: 'Good morning! Start with your high-priority tasks.'
        });
    }

    if (hasMultipleHighPriorityTasks(incompleteTasks)) {
        suggestions.push({
            icon: '⚖️',
            text: 'You have several urgent tasks. Want me to help prioritize?'
        });
    }

    if (getCompletionRate(state.tasks) > 70) {
        suggestions.push({
            icon: '🚀',
            text: "You're crushing it today! Only a few tasks left."
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

function hasMultipleHighPriorityTasks(tasks) {
    return tasks.filter(t => t.priority === 'high').length > 2;
}

function getCompletionRate(tasks) {
    const total = tasks.length;
    if (total === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / total) * 100);
}

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

// voice-related settings
voiceToggle.addEventListener('change', () => {
    state.voiceEnabled = voiceToggle.checked;
    if (!state.voiceEnabled) {
        if (recognizing) {
            continuousMode = false;
            recognition.stop();
        }
        voiceBtn.disabled = true;
        updateVoiceUI('idle');
    } else {
        voiceBtn.disabled = false;
    }
});

continuousToggle.addEventListener('change', () => {
    continuousMode = continuousToggle.checked;
    if (!continuousMode && recognizing) {
        recognition.stop();
    }
});

wakeWordInput.addEventListener('input', () => {
    wakeWord = wakeWordInput.value.trim().toLowerCase();
});

langSelect.addEventListener('change', () => {
    if (recognition) {
        recognition.lang = langSelect.value;
        if (recognizing) {
            recognition.stop();
            recognition.start();
        }
    }
});

// export/import listeners
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
if (exportBtn) {
    exportBtn.addEventListener('click', exportTasks);
}
if (importInput) {
    importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length) {
            importTasks(e.target.files[0]);
            e.target.value = ''; // reset
        }
    });
}

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

function updateConfidence(conf) {
    const meter = document.getElementById('confidenceMeter');
    if (!meter) return;
    if (conf && !isNaN(conf)) {
        const pct = Math.round(conf * 100);
        meter.textContent = `${pct}%`;
        if (conf > 0.75) {
            meter.style.color = 'var(--accent-primary)';
        } else if (conf > 0.5) {
            meter.style.color = 'var(--text-secondary)';
        } else {
            meter.style.color = 'var(--error)';
        }
    } else {
        meter.textContent = '';
    }
}

function checkAllTasksComplete() {
    const incompleteTasks = state.tasks.filter(t => !t.completed);
    if (state.tasks.length > 0 && incompleteTasks.length === 0) {
        celebrateCompletion();
    }
}

function celebrateCompletion() {
    celebrationOverlay.classList.add('active');
    const confettiContainer = document.getElementById('confettiContainer');
    if (confettiContainer) {
        // generate 30 pieces
        for (let i = 0; i < 30; i++) {
            const piece = document.createElement('div');
            piece.className = 'celebration-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
            confettiContainer.appendChild(piece);
            // remove after animation
            piece.addEventListener('animationend', () => piece.remove());
        }
    }
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

// initialize recognition when script loads
initSpeechRecognition();

// toggle listening when voice button is pressed
voiceBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (recognizing) {
        continuousMode = false;
        recognition.stop();
    } else {
        // start or restart
        continuousMode = true; // could be toggled via settings later
        recognition.start();
    }
});

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
`;
document.head.appendChild(style);

function init() {
    if (voiceToggle && !voiceToggle.checked) {
        voiceBtn.disabled = true;
        state.voiceEnabled = false;
    }
    loadTasks();
    updateSuggestions();

    // register service worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('Service worker registered.', reg);
        }).catch(err => {
            console.warn('SW registration failed:', err);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
