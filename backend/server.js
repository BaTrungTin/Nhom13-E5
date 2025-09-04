import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// Store connected users with username
const connectedUsers = new Map();
// Store room information
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining a room
  socket.on('join-room', (data) => {
    const { roomId, username } = data;
    
    console.log(`User ${username} (${socket.id}) trying to join room ${roomId}`);
    
    // Join the room
    socket.join(roomId);
    
    // Store user information
    connectedUsers.set(socket.id, { roomId, socketId: socket.id, username });
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    
    // Get all users in the room
    const roomUsers = Array.from(rooms.get(roomId));
    console.log(`Room ${roomId} now has users:`, roomUsers);
    
    // Notify other users in the room with username
    socket.to(roomId).emit('user-joined', { 
      socketId: socket.id,
      username: username 
    });
    
    // Send list of existing users to the new user
    const existingUsers = roomUsers.filter(id => id !== socket.id);
    if (existingUsers.length > 0) {
      console.log(`Sending existing users to ${username}:`, existingUsers);
      socket.emit('existing-users', existingUsers);
    }
    
    // Force sync room state to all users in the room
    setTimeout(() => {
      const currentRoomUsers = Array.from(rooms.get(roomId) || []);
      console.log(`Force syncing room ${roomId} state to all users:`, currentRoomUsers);
      
      currentRoomUsers.forEach(userId => {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) {
          const otherUsers = currentRoomUsers.filter(id => id !== userId);
          const otherUsersWithNames = otherUsers.map(id => {
            const user = connectedUsers.get(id);
            return { socketId: id, username: user ? user.username : `User-${id.slice(0, 4)}` };
          });
          
          userSocket.emit('room-state-sync', {
            roomId,
            users: otherUsersWithNames,
            userCount: otherUsers.length
          });
        }
      });
    }, 100);
    
    console.log(`User ${username} (${socket.id}) successfully joined room ${roomId}`);
  });

  // Handle WebRTC offer
  socket.on('offer', (data) => {
    console.log(`Offer from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  // Handle WebRTC answer
  socket.on('answer', (data) => {
    console.log(`Answer from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    console.log(`ICE candidate from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Handle user leaving
  socket.on('disconnect', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      const { roomId, username } = userInfo;
      
      // Remove from room
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (no more users)`);
        }
      }
      
      // Notify other users
      socket.to(roomId).emit('user-left', { 
        socketId: socket.id,
        username: username 
      });
      
      // Clean up
      connectedUsers.delete(socket.id);
      console.log(`User ${username} (${socket.id}) left room ${roomId}`);
    }
    console.log('User disconnected:', socket.id);
  });

  // Handle room info request
  socket.on('get-room-info', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      const userList = Array.from(room).map(id => {
        const user = connectedUsers.get(id);
        return user ? { socketId: id, username: user.username } : null;
      }).filter(Boolean);
      
      socket.emit('room-info', { roomId, users: userList });
    }
  });
});

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connectedUsers: connectedUsers.size,
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Add room info endpoint
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (room) {
    const userList = Array.from(room).map(id => {
      const user = connectedUsers.get(id);
      return user ? { socketId: id, username: user.username } : null;
    }).filter(Boolean);
    
    res.json({ roomId, users: userList, userCount: userList.length });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for: http://localhost:5173`);
});
