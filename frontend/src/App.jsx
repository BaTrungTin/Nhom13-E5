import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [remoteUsers, setRemoteUsers] = useState(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState('');
  const [mediaOptions, setMediaOptions] = useState({
    video: false,
    audio: false
  });
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected
  const [incomingCall, setIncomingCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const socketRef = useRef();
  const localVideoRef = useRef();
  const peerConnectionsRef = useRef(new Map());
  const localStreamRef = useRef();

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:3001');
    
    // Socket event handlers
    socketRef.current.on('user-joined', handleUserJoined);
    socketRef.current.on('existing-users', handleExistingUsers);
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('incoming-call', handleIncomingCall);
    socketRef.current.on('call-accepted', handleCallAccepted);
    socketRef.current.on('call-rejected', handleCallRejected);
    socketRef.current.on('call-ended', handleCallEnded);
    socketRef.current.on('room-state-sync', handleRoomStateSync);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Update local video when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Monitor remote users changes to update call status
  useEffect(() => {
    console.log(`🔍 Remote users changed: ${remoteUsers.size}, isInRoom: ${isInRoom}, current callStatus: ${callStatus}`);
    
    if (remoteUsers.size > 0) {
      console.log('✅ Setting call status to connected');
      setCallStatus('connected');
    } else if (isInRoom && remoteUsers.size === 0) {
      console.log('⏳ Setting call status to idle');
      setCallStatus('idle');
    }
  }, [remoteUsers.size, isInRoom]);

  // Debug effect - log every state change
  useEffect(() => {
    console.log(`📊 STATE CHANGE - callStatus: ${callStatus}, remoteUsers: ${remoteUsers.size}, isInRoom: ${isInRoom}`);
  }, [callStatus, remoteUsers.size, isInRoom]);

  // Force sync state every 500ms when in room
  useEffect(() => {
    if (!isInRoom) return;
    
    const interval = setInterval(() => {
      const expectedStatus = remoteUsers.size > 0 ? 'connected' : 'idle';
      if (callStatus !== expectedStatus) {
        console.log(`🔄 Force syncing state: ${callStatus} → ${expectedStatus}`);
        setCallStatus(expectedStatus);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [isInRoom, remoteUsers.size, callStatus]);

  const handleUserJoined = async (data) => {
    console.log('👋 User joined:', data.socketId, data.username);
    
    // Update remote users first
    setRemoteUsers(prev => {
      const newMap = new Map(prev);
      newMap.set(data.socketId, data.username);
      console.log(`📝 Updated remote users: ${newMap.size} users`);
      return newMap;
    });
    
    // Force update call status immediately - use setTimeout to ensure state is updated
    setTimeout(() => {
      console.log('🚀 Force updating call status to connected');
      setCallStatus('connected');
    }, 100);
    
    // Auto-connect if we have media
    if (localStream) {
      await createPeerConnection(data.socketId);
    }
  };

  const handleExistingUsers = async (existingUsers) => {
    console.log('👥 Existing users in room:', existingUsers);
    
    if (existingUsers.length > 0) {
      // Force update call status immediately
      console.log('🚀 Setting call status to connected for existing users');
      setCallStatus('connected');
    }
    
    // Create peer connections for all existing users
    for (const userId of existingUsers) {
      if (userId !== socketRef.current.id) {
        console.log('🔗 Creating peer connection for existing user:', userId);
        await createPeerConnection(userId);
      }
    }
  };

  const handleUserLeft = (data) => {
    console.log('👋 User left:', data.socketId);
    if (peerConnectionsRef.current.has(data.socketId)) {
      peerConnectionsRef.current.get(data.socketId).close();
      peerConnectionsRef.current.delete(data.socketId);
    }
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(data.socketId);
      return newMap;
    });
    
    // Update remote users and then check status
    setRemoteUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(data.socketId);
      console.log(`📝 Updated remote users after user left: ${newMap.size} users`);
      
      // Check if this was the last user
      if (newMap.size === 0) {
        console.log('🚀 Last user left, setting status to idle');
        setTimeout(() => setCallStatus('idle'), 100);
      }
      
      return newMap;
    });
  };

  const handleIncomingCall = (data) => {
    setIncomingCall({
      from: data.from,
      username: data.username,
      roomId: data.roomId
    });
  };

  const handleCallAccepted = (data) => {
    setCallStatus('connected');
    setIncomingCall(null);
  };

  const handleCallRejected = (data) => {
    setCallStatus('idle');
    setIncomingCall(null);
  };

  const handleCallEnded = (data) => {
    setCallStatus('idle');
    leaveRoom();
  };

  const handleRoomStateSync = (data) => {
    console.log('🔄 Room state sync received:', data);
    
    // Update remote users based on backend data
    const newRemoteUsers = new Map();
    if (data.users && data.users.length > 0) {
      data.users.forEach(user => {
        newRemoteUsers.set(user.socketId, user.username);
      });
    }
    
    setRemoteUsers(newRemoteUsers);
    
    // Update call status based on user count
    const newCallStatus = data.userCount > 0 ? 'connected' : 'idle';
    if (callStatus !== newCallStatus) {
      console.log(`🔄 Syncing call status: ${callStatus} → ${newCallStatus}`);
      setCallStatus(newCallStatus);
    }
    
    console.log(`✅ Room state synced: ${data.userCount} users, status: ${newCallStatus}`);
  };

  const createPeerConnection = async (targetSocketId) => {
    console.log(`Creating peer connection to ${targetSocketId}`);
    
    // Check if connection already exists
    if (peerConnectionsRef.current.has(targetSocketId)) {
      console.log(`Peer connection to ${targetSocketId} already exists`);
      return peerConnectionsRef.current.get(targetSocketId);
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Store pending ICE candidates until remote description is set
    const pendingCandidates = [];

    // Add local stream tracks if available
    if (localStreamRef.current) {
      console.log(`Adding ${localStreamRef.current.getTracks().length} tracks to peer connection`);
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    } else {
      console.log('No local stream available for peer connection');
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${targetSocketId}`);
        socketRef.current.emit('ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log(`Received remote stream from ${targetSocketId}`);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(targetSocketId, event.streams[0]);
        return newMap;
      });
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer connection to ${targetSocketId} state:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ Successfully connected to ${targetSocketId}`);
        setCallStatus('connected');
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        console.log(`❌ Connection to ${targetSocketId} failed or disconnected`);
        // Check if we have any other active connections
        const activeConnections = Array.from(peerConnectionsRef.current.values())
          .filter(conn => conn.connectionState === 'connected');
        
        if (activeConnections.length === 0) {
          setCallStatus('idle');
        }
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state to ${targetSocketId}:`, peerConnection.iceConnectionState);
    };

    // Store peer connection with pending candidates
    peerConnectionsRef.current.set(targetSocketId, peerConnection);
    
    // Store pending candidates array for this connection
    peerConnection.pendingCandidates = pendingCandidates;

    // Create and send offer if we have media
    if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
      try {
        console.log(`Creating offer for ${targetSocketId}`);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        console.log(`Sending offer to ${targetSocketId}`);
        socketRef.current.emit('offer', {
          target: targetSocketId,
          offer: offer
        });
      } catch (error) {
        console.error(`Error creating offer for ${targetSocketId}:`, error);
      }
    } else {
      console.log(`No media tracks available, not sending offer to ${targetSocketId}`);
    }

    return peerConnection;
  };

  const handleOffer = async (data) => {
    console.log(`Received offer from ${data.from}`);
    
    // Create peer connection if it doesn't exist
    let peerConnection = peerConnectionsRef.current.get(data.from);
    if (!peerConnection) {
      console.log(`Creating peer connection for incoming offer from ${data.from}`);
      peerConnection = await createPeerConnection(data.from);
    }
    
    try {
      // Set remote description first
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      console.log(`Set remote description for ${data.from}`);
      
      // Add any pending ICE candidates now that remote description is set
      if (peerConnection.pendingCandidates && peerConnection.pendingCandidates.length > 0) {
        console.log(`Adding ${peerConnection.pendingCandidates.length} pending ICE candidates for ${data.from}`);
        for (const candidate of peerConnection.pendingCandidates) {
          try {
            await peerConnection.addIceCandidate(candidate);
            console.log(`Added pending ICE candidate for ${data.from}`);
          } catch (error) {
            console.warn(`Failed to add pending ICE candidate for ${data.from}:`, error);
          }
        }
        peerConnection.pendingCandidates = [];
      }
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log(`Created and set local answer for ${data.from}`);
      
      socketRef.current.emit('answer', {
        target: data.from,
        answer: answer
      });
      console.log(`Sent answer to ${data.from}`);
    } catch (error) {
      console.error(`Error handling offer from ${data.from}:`, error);
    }
  };

  const handleAnswer = async (data) => {
    console.log(`Received answer from ${data.from}`);
    const peerConnection = peerConnectionsRef.current.get(data.from);
    if (peerConnection) {
      try {
        // Only set remote description if we're in the right state
        if (peerConnection.signalingState === 'have-local-offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`Set remote description from answer for ${data.from}`);
          
          // Add any pending ICE candidates now that remote description is set
          if (peerConnection.pendingCandidates && peerConnection.pendingCandidates.length > 0) {
            console.log(`Adding ${peerConnection.pendingCandidates.length} pending ICE candidates for ${data.from}`);
            for (const candidate of peerConnection.pendingCandidates) {
              try {
                await peerConnection.addIceCandidate(candidate);
                console.log(`Added pending ICE candidate for ${data.from}`);
              } catch (error) {
                console.warn(`Failed to add pending ICE candidate for ${data.from}:`, error);
              }
            }
            peerConnection.pendingCandidates = [];
          }
        } else {
          console.log(`Peer connection to ${data.from} is in wrong state: ${peerConnection.signalingState}, cannot set remote description`);
        }
      } catch (error) {
        console.error(`Error setting remote description from answer for ${data.from}:`, error);
      }
    } else {
      console.warn(`No peer connection found for answer from ${data.from}`);
    }
  };

  const handleIceCandidate = async (data) => {
    console.log(`Received ICE candidate from ${data.from}`);
    const peerConnection = peerConnectionsRef.current.get(data.from);
    if (peerConnection) {
      try {
        // Only add ICE candidate if remote description is already set
        if (peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log(`Added ICE candidate from ${data.from}`);
        } else {
          // Store candidate for later when remote description is set
          if (!peerConnection.pendingCandidates) {
            peerConnection.pendingCandidates = [];
          }
          peerConnection.pendingCandidates.push(new RTCIceCandidate(data.candidate));
          console.log(`Stored pending ICE candidate from ${data.from} (remote description not set yet)`);
        }
      } catch (error) {
        console.error(`Error adding ICE candidate from ${data.from}:`, error);
      }
    } else {
      console.warn(`No peer connection found for ICE candidate from ${data.from}`);
    }
  };

  const joinRoom = async () => {
    if (!roomId.trim() || !username.trim()) {
      setError('Vui lòng nhập Room ID và tên người dùng!');
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      
      // Reset all states when joining a new room
      console.log('🔄 Resetting states for new room');
      setCallStatus('idle');
      setRemoteUsers(new Map());
      setRemoteStreams(new Map());
      setIncomingCall(null);
      
      // Clear existing peer connections
      peerConnectionsRef.current.forEach(connection => connection.close());
      peerConnectionsRef.current.clear();
      
      // Get user media based on options
      if (mediaOptions.video || mediaOptions.audio) {
        try {
          // Kiểm tra thiết bị trước
          const deviceInfo = await checkMediaDevices();
          console.log('🔍 Device check result:', deviceInfo);
          
          console.log('🎥 Requesting media with options:', mediaOptions);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: mediaOptions.video,
            audio: mediaOptions.audio
          });
          
          console.log('📹 Local media stream obtained:', stream);
          console.log('📹 Video tracks:', stream.getVideoTracks().length);
          console.log('📹 Audio tracks:', stream.getAudioTracks().length);
          
          // Lưu stream vào ref để sử dụng trong peer connections
          localStreamRef.current = stream;
          setLocalStream(stream);
          
          // Cập nhật trạng thái video/audio dựa trên tracks thực tế
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          
          if (videoTrack) {
            setIsVideoEnabled(videoTrack.enabled);
            console.log('📹 Video track enabled:', videoTrack.enabled);
          }
          
          if (audioTrack) {
            setIsAudioEnabled(audioTrack.enabled);
            console.log('🎤 Audio track enabled:', audioTrack.enabled);
          }
          
        } catch (mediaError) {
          console.error('❌ Media access error:', mediaError);
          console.error('❌ Error details:', {
            name: mediaError.name,
            message: mediaError.message,
            constraint: mediaError.constraint
          });
          
          if (mediaError.name === 'NotAllowedError') {
            setError('❌ Quyền truy cập camera/microphone bị từ chối! Vui lòng cho phép truy cập và thử lại.');
          } else if (mediaError.name === 'NotFoundError') {
            setError('❌ Không tìm thấy camera/microphone! Vui lòng kiểm tra thiết bị.');
          } else if (mediaError.name === 'NotReadableError') {
            setError('❌ Camera/microphone đang được sử dụng bởi ứng dụng khác! Vui lòng đóng các ứng dụng khác.');
          } else if (mediaError.name === 'OverconstrainedError') {
            setError('❌ Camera/microphone không hỗ trợ cài đặt yêu cầu! Thử chọn tùy chọn khác.');
          } else if (mediaError.name === 'SecurityError') {
            setError('❌ Lỗi bảo mật! Vui lòng sử dụng HTTPS hoặc localhost.');
          } else {
            setError(`❌ Lỗi truy cập media: ${mediaError.message}`);
          }
          setIsLoading(false);
          return;
        }
      } else {
        setLocalStream(null);
        localStreamRef.current = null;
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        console.log('📱 Joining without media');
      }

      // Connect to socket and join room
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
      
      console.log('🚀 Joining room:', roomId, 'with username:', username);
      socketRef.current.emit('join-room', { roomId, username });
      
      setIsInRoom(true);
      setIsLoading(false);
      
      console.log('✅ Successfully joined room');
      
    } catch (error) {
      console.error('❌ Error joining room:', error);
      setError('Lỗi khi tham gia phòng: ' + error.message);
      setIsLoading(false);
    }
  };

  const leaveRoom = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
      localStreamRef.current = null;
    }

    // Close peer connections
    peerConnectionsRef.current.forEach(connection => connection.close());
    peerConnectionsRef.current.clear();

    // Leave room
    socketRef.current.emit('leave-room', roomId);
    setIsInRoom(false);
    setRemoteStreams(new Map());
    setRemoteUsers(new Map());
    setRoomId('');
    setUsername('');
    setError('');
    setMediaOptions({ video: false, audio: false });
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
    setCallStatus('idle');
    setIncomingCall(null);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('📹 Video toggled:', videoTrack.enabled);
        
        // Update all peer connections with new track state
        peerConnectionsRef.current.forEach((connection, socketId) => {
          const sender = connection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack.enabled ? videoTrack : null);
            console.log(`📹 Updated video track for ${socketId}:`, videoTrack.enabled);
          }
        });
      } else {
        console.warn('📹 No video track found to toggle');
      }
    } else {
      console.warn('📹 No local stream found to toggle video');
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('🎤 Audio toggled:', audioTrack.enabled);
        
        // Update all peer connections with new track state
        peerConnectionsRef.current.forEach((connection, socketId) => {
          const sender = connection.getSenders().find(s => s.track && s.track.kind === 'audio');
          if (sender) {
            sender.replaceTrack(audioTrack.enabled ? audioTrack : null);
            console.log(`🎤 Updated audio track for ${socketId}:`, audioTrack.enabled);
          }
        });
      } else {
        console.warn('🎤 No audio track found to toggle');
      }
    } else {
      console.warn('🎤 No local stream found to toggle audio');
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          }
        });
        
        // Replace video track
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = Array.from(peerConnectionsRef.current.values())[0]?.getSenders()
          .find(s => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
        
        setIsScreenSharing(true);
        
        // Stop screen sharing when user stops
        videoTrack.onended = () => {
          setIsScreenSharing(false);
        };
        
      } catch (error) {
        console.error('Error sharing screen:', error);
        setError('Không thể chia sẻ màn hình: ' + error.message);
      }
    }
  };

  const generateRoomId = () => {
    setRoomId(uuidv4().substring(0, 8));
  };

  const generateUsername = () => {
    const adjectives = ['Vui', 'Thân', 'Tốt', 'Xinh', 'Đẹp', 'Tài', 'Giỏi', 'Thông', 'Minh', 'Sáng'];
    const nouns = ['Bạn', 'Người', 'Anh', 'Chị', 'Em', 'Bạn', 'Người', 'Anh', 'Chị', 'Em'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 1000);
    setUsername(`${randomAdjective}${randomNoun}${randomNumber}`);
  };

  // Hàm kiểm tra camera/microphone trước khi tham gia
  const checkMediaDevices = async () => {
    try {
      console.log('🔍 Checking available media devices...');
      
      // Kiểm tra xem có hỗ trợ getUserMedia không
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ getUserMedia API');
      }
      
      // Lấy danh sách thiết bị
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      console.log('📹 Video devices found:', videoDevices.length);
      console.log('🎤 Audio devices found:', audioDevices.length);
      
      if (videoDevices.length === 0 && mediaOptions.video) {
        console.warn('⚠️ No video devices found but video is requested');
      }
      
      if (audioDevices.length === 0 && mediaOptions.audio) {
        console.warn('⚠️ No audio devices found but audio is requested');
      }
      
      return {
        hasVideo: videoDevices.length > 0,
        hasAudio: audioDevices.length > 0,
        devices: { video: videoDevices, audio: audioDevices }
      };
      
    } catch (error) {
      console.error('❌ Error checking media devices:', error);
      throw error;
    }
  };

  const toggleMediaOption = (type) => {
    setMediaOptions(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const acceptCall = () => {
    if (incomingCall) {
      setCallStatus('connected');
      setIncomingCall(null);
      // Auto-join the room
      setRoomId(incomingCall.roomId);
      joinRoom();
    }
  };

  const rejectCall = () => {
    setIncomingCall(null);
    setCallStatus('idle');
  };

  const endCall = () => {
    setCallStatus('idle');
    leaveRoom();
  };

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">Video Call App</h1>
        
        {/* Incoming Call Modal */}
        {incomingCall && (
          <div className="incoming-call-modal">
            <div className="modal-content">
              <h3>📞 Cuộc gọi đến</h3>
              <p>Từ: <strong>{incomingCall.username}</strong></p>
              <p>Room: <strong>{incomingCall.roomId}</strong></p>
              <div className="call-actions">
                <button onClick={acceptCall} className="accept-btn">
                  ✅ Nhận cuộc gọi
                </button>
                <button onClick={rejectCall} className="reject-btn">
                  ❌ Từ chối
                </button>
              </div>
            </div>
          </div>
        )}
        
        {!isInRoom ? (
          <div className="join-section">
            <div className="input-group">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên của bạn"
                className="username-input"
              />
              <button onClick={generateUsername} className="generate-btn">
                Tạo tên
              </button>
            </div>
            
            <div className="input-group">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Nhập Room ID"
                className="room-input"
              />
              <button onClick={generateRoomId} className="generate-btn">
                Tạo ID
              </button>
            </div>

            {/* Media Options */}
            <div className="media-options">
              <h3>Chọn phương thức tham gia:</h3>
              <div className="option-buttons">
                <button
                  onClick={() => toggleMediaOption('video')}
                  className={`option-btn ${mediaOptions.video ? 'active' : ''}`}
                >
                  📹 Video
                </button>
                <button
                  onClick={() => toggleMediaOption('audio')}
                  className={`option-btn ${mediaOptions.audio ? 'active' : ''}`}
                >
                  🎤 Audio
                </button>
                <button
                  onClick={() => setMediaOptions({ video: false, audio: false })}
                  className={`option-btn ${!mediaOptions.video && !mediaOptions.audio ? 'active' : ''}`}
                >
                  💬 Chỉ tham gia (không media)
                </button>
              </div>
              
              {/* Test Camera Button */}
              <div className="test-camera-section">
                <button
                  onClick={async () => {
                    try {
                      setError('');
                      console.log('🧪 Testing camera...');
                      const deviceInfo = await checkMediaDevices();
                      if (deviceInfo.hasVideo) {
                        const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
                        console.log('✅ Camera test successful!');
                        setError('✅ Camera hoạt động bình thường!');
                        // Stop test stream
                        testStream.getTracks().forEach(track => track.stop());
                      } else {
                        setError('❌ Không tìm thấy camera!');
                      }
                    } catch (error) {
                      console.error('❌ Camera test failed:', error);
                      setError(`❌ Lỗi camera: ${error.message}`);
                    }
                  }}
                  className="test-camera-btn"
                >
                  🧪 Kiểm tra Camera
                </button>
              </div>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <button onClick={joinRoom} className="join-btn">
              {mediaOptions.video || mediaOptions.audio ? '📞 Bắt đầu cuộc gọi' : '🚪 Tham gia phòng'}
            </button>
          </div>
        ) : (
          <div className="video-section">
            {/* Call Status */}
            <div className="call-status">
              <div className={`status-indicator ${callStatus}`}>
                {callStatus === 'idle' && '⏸️ Chờ người tham gia...'}
                {callStatus === 'calling' && '📞 Đang gọi...'}
                {callStatus === 'connected' && '✅ Đã kết nối'}
              </div>
            </div>

            <div className="video-grid">
              {/* Local video - only show if video is enabled */}
              {(localStream && isVideoEnabled) && (
                <div className="video-container local-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="video-element"
                  />
                  <div className="video-label">{username}</div>
                </div>
              )}
              
              {/* Remote videos */}
              {Array.from(remoteStreams.entries()).map(([socketId, stream]) => (
                <div key={socketId} className="video-container remote-video">
                  <video
                    autoPlay
                    playsInline
                    className="video-element"
                    ref={(el) => {
                      if (el) el.srcObject = stream;
                    }}
                  />
                  <div className="video-label">
                    {remoteUsers.get(socketId) || 'Người khác'}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Controls - only show relevant ones */}
            <div className="controls">
              {localStream && (
                <>
                  <button
                    onClick={toggleVideo}
                    className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
                    disabled={!localStream.getVideoTracks().length}
                  >
                    {isVideoEnabled ? '🔴 Tắt video' : '📹 Bật video'}
                  </button>
                  
                  <button
                    onClick={toggleAudio}
                    className={`control-btn ${!isAudioEnabled ? 'disabled' : ''}`}
                    disabled={!localStream.getAudioTracks().length}
                  >
                    {isAudioEnabled ? '🔇 Tắt mic' : '🎤 Bật mic'}
                  </button>
                  
                  <button
                    onClick={toggleScreenShare}
                    className={`control-btn ${isScreenSharing ? 'sharing' : ''}`}
                    disabled={!localStream.getVideoTracks().length}
                  >
                    {isScreenSharing ? '🖥️ Dừng chia sẻ' : '🖥️ Chia sẻ màn hình'}
                  </button>
                </>
              )}
              
              <button onClick={endCall} className="control-btn end-call-btn">
                📞 Kết thúc cuộc gọi
              </button>
            </div>
            
            <div className="room-info">
              <div>Room ID: <span className="room-id">{roomId}</span></div>
              <div>Bạn: <span className="username-display">{username}</span></div>
              <div>Phương thức: <span className="media-type">
                {!localStream ? 'Chỉ tham gia' : 
                 `${isVideoEnabled ? 'Video' : ''}${isVideoEnabled && isAudioEnabled ? ' + ' : ''}${isAudioEnabled ? 'Audio' : ''}`
                }
              </span></div>
              <div>Trạng thái: <span className={`call-status-text ${callStatus}`}>
                {callStatus === 'idle' ? 'Chờ người tham gia' : 
                 callStatus === 'calling' ? 'Đang gọi' : 'Đã kết nối'}
              </span></div>
              <div>Người trong phòng: <span className="user-count">
                {remoteUsers.size + 1} người
              </span></div>
              <div>Remote Users: <span className="remote-users-list">
                {Array.from(remoteUsers.values()).join(', ') || 'Không có'}
              </span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
