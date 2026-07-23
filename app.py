from flask import Flask, render_template, request, jsonify
from scraper import ChannelScraper
import json

app = Flask(__name__)

# สร้าง instance ของ scraper
scraper = ChannelScraper()

@app.route('/')
def index():
    """หน้าแรก - แสดงรายการช่องทั้งหมด"""
    channels = scraper.load_channels()
    
    # แบ่งหมวดหมู่ตามชื่อช่อง
    categories = {}
    for channel in channels:
        # สร้างหมวดหมู่อัตโนมัติจากชื่อ
        name = channel['name'].lower()
        if any(word in name for word in ['sport', 'espn', 'fox sport', 'bein']):
            category = 'กีฬา'
        elif any(word in name for word in ['news', 'bbc', 'cnn', 'cnbc']):
            category = 'ข่าว'
        elif any(word in name for word in ['movie', 'hbo', 'cinemax', 'axn']):
            category = 'ภาพยนตร์'
        elif any(word in name for word in ['cartoon', 'disney', 'nickelodeon']):
            category = 'การ์ตูน'
        else:
            category = 'ทั่วไป'
        
        if category not in categories:
            categories[category] = []
        categories[category].append(channel)
    
    return render_template('index.html', categories=categories, all_channels=channels)

@app.route('/watch/<channel_id>')
def watch_channel(channel_id):
    """หน้าดูช่อง"""
    channels = scraper.load_channels()
    channel = next((c for c in channels if c['id'] == channel_id), None)
    
    if not channel:
        return "ไม่พบช่องนี้", 404
    
    return render_template('player.html', channel=channel)

@app.route('/clean/<channel_id>')
def clean_channel(channel_id):
    """หน้า player ที่สะอาดกว่า"""
    return render_template('clean_player.html', channel_id=channel_id)

@app.route('/search')
def search():
    """ค้นหาช่อง"""
    query = request.args.get('q', '').lower()
    channels = scraper.load_channels()
    
    if query:
        filtered = [c for c in channels if query in c['name'].lower()]
    else:
        filtered = channels
    
    return render_template('index.html', categories={'ผลการค้นหา': filtered}, all_channels=channels, search_query=query)

@app.route('/api/channels')
def api_channels():
    """API สำหรับดึงข้อมูลช่อง (JSON)"""
    channels = scraper.load_channels()
    return jsonify(channels)

@app.route('/refresh')
def refresh_channels():
    """รีเฟรชข้อมูลช่องใหม่"""
    channels = scraper.get_channels()
    scraper.save_channels(channels)
    return jsonify({"status": "success", "count": len(channels)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
