// Initial Configuration
const TARGET_WEIGHT = 70;
const HEIGHT_CM = 167;

// Data Structure: { date: 'YYYY-MM-DD', weight: 78.0, cal: 1500 }
// 合併 檔案預設紀錄 (DEFAULT_RECORDS) 與 瀏覽器本地紀錄 (LocalStorage)
let localRecords = JSON.parse(localStorage.getItem('weightRecords')) || [];
let adherenceData = JSON.parse(localStorage.getItem('weightAdherence')) || {};
let records = [...DEFAULT_RECORDS];

// 合併邏輯：如果日期相同，以 LocalStorage 的最新紀錄為主
localRecords.forEach(localRecord => {
    const index = records.findIndex(r => r.date === localRecord.date);
    if (index > -1) {
        records[index] = localRecord;
    } else {
        records.push(localRecord);
    }
});
records.sort((a, b) => new Date(a.date) - new Date(b.date));

// DOM Elements
const form = document.getElementById('record-form');
const historyList = document.getElementById('history-list');
const currentBmiEl = document.getElementById('current-bmi');
const bmiStatusEl = document.getElementById('bmi-status');
const currentWeightEl = document.getElementById('current-weight');
const weightDiffEl = document.getElementById('weight-diff');
const adherenceRateEl = document.getElementById('adherence-rate');
const exportBtn = document.getElementById('export-btn');

// Plan Elements
const planDayLabel = document.getElementById('plan-day-label');
const planB = document.getElementById('plan-b');
const planL = document.getElementById('plan-l');
const planD = document.getElementById('plan-d');
const planE = document.getElementById('plan-e');
const planCheckboxes = {
    breakfast: document.getElementById('chk-breakfast'),
    lunch: document.getElementById('chk-lunch'),
    dinner: document.getElementById('chk-dinner'),
    exercise: document.getElementById('chk-exercise')
};

let weightChart;
let adherenceChart;

// Initialize
function init() {
    updateDashboard();
    renderHistory();
    initChart();
    initAdherenceChart();
    loadTodayPlan();
    // Default date to today
    document.getElementById('date-input').valueAsDate = new Date();
}

function calculateBMI(weight) {
    const heightM = HEIGHT_CM / 100;
    return (weight / (heightM * heightM)).toFixed(1);
}

function getBMIStatus(bmi) {
    if (bmi < 18.5) return '過輕';
    if (bmi < 24) return '正常';
    if (bmi < 27) return '過重';
    return '肥胖';
}

function updateDashboard() {
    if (records.length === 0) return;

    // Last record is the current one
    const latest = records[records.length - 1];
    const bmi = calculateBMI(latest.weight);

    currentBmiEl.textContent = bmi;
    bmiStatusEl.textContent = getBMIStatus(bmi);

    currentWeightEl.textContent = `${latest.weight} kg`;
    const diff = (latest.weight - TARGET_WEIGHT).toFixed(1);
    weightDiffEl.textContent = diff > 0 ? `距目標還差 ${diff} kg` : '已達成目標！';

    // Calculate Adherence Rate
    const totalDays = Object.keys(adherenceData).length;
    let rate = 0;
    if (totalDays > 0) {
        let totalChecked = 0;
        let totalItems = totalDays * 4;
        Object.values(adherenceData).forEach(day => {
            if (day.breakfast) totalChecked++;
            if (day.lunch) totalChecked++;
            if (day.dinner) totalChecked++;
            if (day.exercise) totalChecked++;
        });
        rate = Math.round((totalChecked / totalItems) * 100);
        adherenceRateEl.textContent = `${rate}%`;
    }

    if (adherenceChart) {
        adherenceChart.data.datasets[0].data = [rate, 100 - rate];
        adherenceChart.update();
    }
}

function loadTodayPlan() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sun, 1: Mon... 6: Sat

    // Get or Set Plan Start Date
    let planStartDate = localStorage.getItem('planStartDate');
    if (!planStartDate) {
        planStartDate = new Date().toISOString().split('T')[0];
        localStorage.setItem('planStartDate', planStartDate);
    }
    const startOfPlan = new Date(planStartDate);

    const diffTime = today - startOfPlan;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        document.getElementById('today-plan-content').classList.add('hidden');
        document.getElementById('weekend-msg').classList.remove('hidden');
        return;
    }

    // Calculate week and day index (1-based, only Mon-Fri)
    // For 60 day plan, we need to map diffDays to monotonic workdays
    const weeksPassed = Math.floor(diffDays / 7);
    const dayIndex = (dayOfWeek - 1);
    const totalWorkDaysPassed = weeksPassed * 5 + dayIndex;

    const dailyPlan = window.PLAN_DATA[totalWorkDaysPassed % 60];
    if (dailyPlan) {
        planDayLabel.textContent = `(第${dailyPlan.week}週 第${dailyPlan.day}天)`;
        planB.textContent = dailyPlan.breakfast;
        planL.textContent = dailyPlan.lunch;
        planD.textContent = dailyPlan.dinner;
        planE.textContent = dailyPlan.exercise;

        // Load saved state for today
        const dateKey = today.toISOString().split('T')[0];
        const saved = adherenceData[dateKey] || { breakfast: false, lunch: false, dinner: false, exercise: false };
        planCheckboxes.breakfast.checked = saved.breakfast;
        planCheckboxes.lunch.checked = saved.lunch;
        planCheckboxes.dinner.checked = saved.dinner;
        planCheckboxes.exercise.checked = saved.exercise;
    }
}

// Checkbox event listeners
Object.keys(planCheckboxes).forEach(key => {
    planCheckboxes[key].addEventListener('change', () => {
        const today = new Date().toISOString().split('T')[0];
        if (!adherenceData[today]) adherenceData[today] = { breakfast: false, lunch: false, dinner: false, exercise: false };
        adherenceData[today][key] = planCheckboxes[key].checked;
        localStorage.setItem('weightAdherence', JSON.stringify(adherenceData));
        updateDashboard();
    });
});

function initAdherenceChart() {
    const ctx = document.getElementById('adherenceChart').getContext('2d');
    adherenceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#38bdf8', 'rgba(255,255,255,0.05)'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    });
}

function renderHistory() {
    historyList.innerHTML = '';
    // Reverse to show latest first
    [...records].reverse().forEach(record => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <span class="history-date">${record.date}</span>
            <span class="history-stats">${record.weight} kg / ${record.cal} kcal</span>
        `;
        historyList.appendChild(li);
    });
}

function initChart() {
    const ctx = document.getElementById('weightChart').getContext('2d');

    const labels = records.map(r => r.date);
    const data = records.map(r => r.weight);

    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '體重趨勢 (kg)',
                data: data,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#38bdf8'
            }, {
                label: '目標體重',
                data: Array(labels.length).fill(TARGET_WEIGHT),
                borderColor: 'rgba(244, 114, 182, 0.5)',
                borderDash: [5, 5],
                borderWidth: 1,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
}

function updateChart() {
    weightChart.data.labels = records.map(r => r.date);
    weightChart.data.datasets[0].data = records.map(r => r.weight);
    weightChart.data.datasets[1].data = Array(records.length).fill(TARGET_WEIGHT);
    weightChart.update();
}

// Event Listeners
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const newRecord = {
        date: document.getElementById('date-input').value,
        weight: parseFloat(document.getElementById('weight-input').value),
        cal: parseInt(document.getElementById('cal-input').value)
    };

    // Check if date already exists
    const existingIndex = records.findIndex(r => r.date === newRecord.date);
    if (existingIndex > -1) {
        records[existingIndex] = newRecord;
    } else {
        records.push(newRecord);
        // Sort by date
        records.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    localStorage.setItem('weightRecords', JSON.stringify(records));

    updateDashboard();
    renderHistory();
    updateChart();
    form.reset();
    document.getElementById('date-input').valueAsDate = new Date();
});

exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weight_records_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
});

init();
