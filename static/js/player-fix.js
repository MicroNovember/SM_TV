// แก้ไขปัญหา iframe และ blocked resources
window.addEventListener('load', function() {
    console.log('Player loaded, applying fixes...');
    
    // แก้ไขปัญหา CORS และ blocked scripts
    const iframe = document.getElementById('playerFrame');
    if (iframe) {
        // เพิ่ม sandbox attributes เพื่อความปลอดภัย
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
        
        // ตรวจสอบว่า iframe โหลดได้หรือไม่
        iframe.onload = function() {
            console.log('Iframe loaded successfully');
        };
        
        iframe.onerror = function() {
            console.log('Iframe failed to load, trying alternative...');
            tryAlternativeSource();
        };
    }
});

// ลองแหล่งทางเลือกถ้าหลักไม่ทำงาน
function tryAlternativeSource() {
    const alternatives = [
        '/cast/stream-{{ channel.id }}.php',
        '/watch/stream-{{ channel.id }}.php', 
        '/plus/stream-{{ channel.id }}.php',
        '/stream/stream-{{ channel.id }}.php',
        '/casting/stream-{{ channel.id }}.php'
    ];
    
    let attempt = 0;
    const iframe = document.getElementById('playerFrame');
    const originalSrc = iframe.src;
    
    function tryNext() {
        if (attempt >= alternatives.length) {
            showError('ไม่สามารถโหลดสตรีมได้ กรุณาลองใหม่ภายหลัง');
            return;
        }
        
        const newSrc = alternatives[attempt];
        console.log(`Trying alternative source ${attempt + 1}: ${newSrc}`);
        
        iframe.src = newSrc;
        attempt++;
        
        // รอ 5 วินาทีแล้วลองอันถัดไป
        setTimeout(() => {
            if (!isIframeWorking()) {
                tryNext();
            }
        }, 5000);
    }
    
    tryNext();
}

// ตรวจสอบว่า iframe ทำงานได้หรือไม่
function isIframeWorking() {
    try {
        const iframe = document.getElementById('playerFrame');
        return iframe.contentWindow && iframe.contentWindow.location.href !== 'about:blank';
    } catch (e) {
        return false;
    }
}

// แสดงข้อความ error
function showError(message) {
    const playerContainer = document.querySelector('.tv-frame');
    if (playerContainer) {
        playerContainer.innerHTML = `
            <div class="bg-red-900 text-white p-8 rounded-lg text-center">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-xl font-bold mb-2">ไม่สามารถโหลดสตรีมได้</h3>
                <p class="mb-4">${message}</p>
                <div class="space-y-2">
                    <button onclick="location.reload()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-2">
                        <i class="fas fa-redo mr-2"></i>โหลดหน้าใหม่
                    </button>
                    <button onclick="window.open('https://dlhd.pk/watch.php?id={{ channel.id }}', '_blank')" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                        <i class="fas fa-external-link-alt mr-2"></i>เปิดในหน้าต่างใหม่
                    </button>
                </div>
            </div>
        `;
    }
}

// ป้องกัน popup blockers
function openInNewWindow(url) {
    const newWindow = window.open(url, '_blank', 'width=1200,height=800');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        alert('กรุณาอนุญาต popup สำหรับเว็บไซต์นี้เพื่อเปิดสตรีมในหน้าต่างใหม่');
    }
}

// แก้ไขปัญหา blocked resources ด้วย CSP
if ('serviceWorker' in navigator) {
    // ไม่ใช้ service worker เพื่อป้องกันปัญหา
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}
