# Video Call App với WebRTC

Ứng dụng video call đơn giản sử dụng WebRTC và Socket.IO với giao diện dark teal theme đẹp mắt.

## 🚀 Hướng dẫn cài đặt nhanh

### Yêu cầu hệ thống
- **Node.js** phiên bản 16 trở lên
- **npm** hoặc **yarn**
- Trình duyệt hiện đại hỗ trợ WebRTC (Chrome, Firefox, Safari, Edge)

### Cài đặt và chạy

#### Phương pháp 1: Sử dụng script tự động (Khuyến nghị)
```bash
# Clone hoặc tải source code về
# Sau đó chạy lệnh sau để cài đặt tất cả dependencies:
npm run install-all

# Chạy cả backend và frontend cùng lúc:
npm run dev
```

#### Phương pháp 2: Cài đặt thủ công
```bash
# 1. Cài đặt dependencies cho root project
npm install

# 2. Cài đặt backend
cd backend
npm install
cd ..

# 3. Cài đặt frontend  
cd frontend
npm install
cd ..

# 4. Chạy backend (terminal 1)
npm run backend

# 5. Chạy frontend (terminal 2)
npm run frontend
```

### Truy cập ứng dụng
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## 📦 Các lệnh hữu ích

```bash
# Cài đặt tất cả dependencies
npm run setup

# Chạy development (cả backend và frontend)
npm run dev

# Chỉ chạy backend
npm run backend

# Chỉ chạy frontend
npm run frontend

# Build production
npm run build

# Xóa tất cả node_modules (để cài đặt lại)
npm run clean
```

## 🔧 Cấu hình

### Environment Variables
Tạo file `.env` từ `env.example` nếu cần thay đổi cấu hình:

```bash
cp env.example .env
```

Các biến môi trường có thể cấu hình:
- `PORT`: Port cho backend server (mặc định: 3001)
- `VITE_SERVER_URL`: URL của backend server cho frontend

### Ports mặc định
- **Backend**: 3001
- **Frontend**: 5173 (Vite dev server)

## 📋 Tính năng

- ✅ **Video call trực tiếp** sử dụng WebRTC
- ✅ **Gọi cho nhau** - Tính năng gọi trực tiếp!
- ✅ **Linh hoạt về media** - Không bắt buộc camera/audio!
- ✅ Tạo và tham gia room bằng ID
- ✅ **Đặt tên người dùng** - Tính năng mới!
- ✅ Tự động tạo tên ngẫu nhiên
- ✅ Bật/tắt video và audio
- ✅ Chia sẻ màn hình
- ✅ **Trạng thái cuộc gọi** - Hiển thị rõ ràng
- ✅ Giao diện responsive và đẹp mắt
- ✅ Dark teal theme
- ✅ Hỗ trợ nhiều người dùng
- ✅ Hiển thị tên người dùng trên video

## Sử dụng

### 🚀 **Bắt đầu cuộc gọi:**

1. **Thiết lập cuộc gọi:**
   - Nhập tên của bạn hoặc nhấn "Tạo tên" để tạo tên ngẫu nhiên
   - Nhấn "Tạo ID" để tạo room ID mới
   - Hoặc nhập room ID có sẵn
   - **Chọn phương thức tham gia:**
     - 📹 **Video**: Tham gia với camera
     - 🎤 **Audio**: Chỉ tham gia với microphone
     - 💬 **Chỉ tham gia**: Không cần camera/audio (chỉ để xem người khác)
   - Nhấn "📞 Bắt đầu cuộc gọi"

2. **Chia sẻ room ID:**
   - Gửi room ID cho người khác để họ tham gia
   - Mỗi người sẽ thấy tên của nhau trên video
   - Có thể tham gia với các phương thức khác nhau

### 📞 **Tham gia cuộc gọi:**

1. **Nhận cuộc gọi:**
   - Khi có người gọi, sẽ hiện modal "Cuộc gọi đến"
   - Hiển thị tên người gọi và room ID
   - Chọn "✅ Nhận cuộc gọi" hoặc "❌ Từ chối"

2. **Tham gia trực tiếp:**
   - Nhập room ID và tên của bạn
   - Chọn phương thức tham gia
   - Nhấn "🚪 Tham gia phòng"

### 🎮 **Điều khiển cuộc gọi:**

- 🔴 Tắt/Bật video (nếu có camera)
- 🔇 Tắt/Bật microphone (nếu có audio)
- 🖥️ Chia sẻ màn hình (nếu có video)
- 📞 Kết thúc cuộc gọi

### 📊 **Trạng thái cuộc gọi:**

- ⏸️ **Chờ kết nối**: Đang trong phòng, chờ người khác
- 📞 **Đang gọi**: Đã bắt đầu cuộc gọi với media
- ✅ **Đã kết nối**: Đã có người tham gia và kết nối thành công

## Ưu điểm của tính năng gọi

- **Gọi trực tiếp**: Không cần chia sẻ room ID phức tạp
- **Trạng thái rõ ràng**: Biết chính xác tình trạng cuộc gọi
- **Modal cuộc gọi đến**: Hiển thị đẹp mắt khi có người gọi
- **Tự động kết nối**: Khi người khác tham gia, tự động kết nối
- **Giao diện thân thiện**: Dễ dàng nhận/từ chối cuộc gọi

## Ưu điểm của tính năng linh hoạt

- **Không bắt buộc camera**: Có thể tham gia cuộc gọi mà không cần camera
- **Chỉ audio**: Phù hợp khi không muốn hiện mặt
- **Chỉ xem**: Có thể tham gia để xem người khác mà không cần thiết bị
- **Tự động fallback**: Nếu camera/audio bị lỗi, vẫn có thể tham gia
- **Tiết kiệm băng thông**: Không cần gửi video nếu không muốn

## Công nghệ sử dụng

- **Frontend:** React 19, Vite
- **Backend:** Node.js, Express, Socket.IO
- **WebRTC:** Peer-to-peer video streaming
- **Styling:** CSS với dark teal theme

## Cấu trúc dự án

```
├── backend/
│   ├── server.js          # WebRTC signaling server với calling features
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Component chính với calling & media options
│   │   ├── App.css        # Styling cho calling features
│   │   └── index.css      # Global styles
│   └── package.json
└── README.md
```

## Lưu ý

- **Camera/Microphone không bắt buộc** - có thể tham gia mà không cần
- **Gọi trực tiếp** - có thể gọi cho nhau thông qua room ID
- Hỗ trợ các trình duyệt hiện đại với WebRTC
- Tên người dùng sẽ được hiển thị trên video của họ
- Nếu media bị lỗi, vẫn có thể tham gia cuộc gọi

## 🚀 Deployment

### Production Build
```bash
# Build frontend cho production
npm run build

# Chạy backend production
npm start
```

### Docker (Tùy chọn)
Có thể tạo Dockerfile để deploy dễ dàng hơn.

### Cloud Deployment
- **Frontend**: Có thể deploy lên Vercel, Netlify, hoặc GitHub Pages
- **Backend**: Có thể deploy lên Heroku, Railway, hoặc DigitalOcean

## 🛠️ Troubleshooting

### Lỗi thường gặp

#### 1. **Không thể cài đặt dependencies**
```bash
# Xóa node_modules và cài đặt lại
npm run clean
npm run setup
```

#### 2. **Port đã được sử dụng**
```bash
# Thay đổi port trong .env file
PORT=3002
```

#### 3. **Không thể truy cập camera/microphone**
- Kiểm tra quyền truy cập camera/microphone trong trình duyệt
- Không sao! Chọn "Chỉ tham gia" hoặc chỉ audio

#### 4. **Không kết nối được**
- Đảm bảo backend đang chạy trên port 3001
- Kiểm tra firewall và antivirus
- Thử refresh trang

#### 5. **Video bị lag**
- Kiểm tra kết nối internet
- Đóng các tab khác đang sử dụng băng thông

#### 6. **Không thấy tên người dùng**
- Đảm bảo đã nhập tên trước khi tham gia
- Refresh trang nếu cần

#### 7. **Media bị lỗi**
- Chọn phương thức khác (chỉ audio, chỉ tham gia)
- Kiểm tra thiết bị camera/microphone

#### 8. **Không nhận được cuộc gọi**
- Kiểm tra kết nối internet
- Đảm bảo đang online và trong cùng room

## Phát triển

Để thêm tính năng mới:
1. Cập nhật backend trong `server.js`
2. Cập nhật frontend trong `App.jsx`
3. Thêm styling trong `App.css`

## License

MIT License
