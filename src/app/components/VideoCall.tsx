"use client";
import { useEffect, useRef, useState } from 'react';

// interface PeerConnection {
//     pc: RTCPeerConnection;
//     remoteStream: MediaStream | null;
// }

export default function VideoCall() {
    // State and Refs
    const [roomId, setRoomId] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);

    // Refs for video elements and connections
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    // WebRTC Configuration
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    // Initialize WebSocket connection
    useEffect(() => {
        setupWebSocket();
        return () => {
            cleanup();
        };
    }, []);

    const setupWebSocket = () => {
        wsRef.current = new WebSocket('ws://localhost:8000/ws');

        wsRef.current.onopen = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };

        wsRef.current.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
        };

        wsRef.current.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        wsRef.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
    };

    const handleWebSocketMessage = async (data) => {
        try {
            switch (data.type) {
                case 'offer':
                    await handleOffer(data.offer);
                    break;
                case 'answer':
                    await handleAnswer(data.answer);
                    break;
                case 'ice-candidate':
                    await handleNewICECandidate(data.candidate);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    };

    const createPeerConnection = async () => {
        try {
            const pc = new RTCPeerConnection(rtcConfig);
            peerConnectionRef.current = pc;

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sendMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        roomId,
                    });
                }
            };

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                setConnectionStatus(pc.connectionState);
            };

            // Handle receiving remote stream
            pc.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Add local stream if it exists
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    if (localStreamRef.current) {
                        pc.addTrack(track, localStreamRef.current);
                    }
                });
            }

            return pc;
        } catch (error) {
            console.error('Error creating peer connection:', error);
            throw error;
        }
    };

    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            setIsCameraOn(true);
            setIsMicOn(true);

            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    };

    const startCall = async () => {
        if (!roomId) {
            alert('Please enter a room ID');
            return;
        }

        try {
            // Start local stream if not already started
            if (!localStreamRef.current) {
                await startLocalStream();
            }

            // Create peer connection if not exists
            if (!peerConnectionRef.current) {
                await createPeerConnection();
            }

            // Create and send offer
            const offer = await peerConnectionRef.current?.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });

            await peerConnectionRef.current?.setLocalDescription(offer);

            sendMessage({
                type: 'offer',
                offer,
                roomId,
            });
        } catch (error) {
            console.error('Error starting call:', error);
        }
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
        try {
            if (!peerConnectionRef.current) {
                await createPeerConnection();
            }

            await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(offer));

            // Create and send answer
            const answer = await peerConnectionRef.current?.createAnswer();
            await peerConnectionRef.current?.setLocalDescription(answer);

            sendMessage({
                type: 'answer',
                answer,
                roomId,
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
        try {
            await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    };

    const handleNewICECandidate = async (candidate: RTCIceCandidateInit) => {
        try {
            await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    };

    const sendMessage = (message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            setIsCameraOn(videoTrack.enabled);
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsMicOn(audioTrack.enabled);
        }
    };

    const cleanup = () => {
        // Stop all tracks in local stream
        localStreamRef.current?.getTracks().forEach(track => track.stop());

        // Close peer connection
        peerConnectionRef.current?.close();

        // Close WebSocket connection
        wsRef.current?.close();
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            <div>
                <div>
                    <div>Video Call</div>
                </div>
                <div>
                    <div className="mb-4 flex items-center gap-4">
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Enter room ID"
                            className="w-64"
                        />
                        <button
                            onClick={startCall}
                            disabled={!isConnected}
                        >
                            {isConnected ? "Start Call" : "Connecting..."}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={toggleCamera}>
                            {isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
                        </button>
                        <button onClick={toggleMic}>
                            {isMicOn ? "Mute" : "Unmute"}
                        </button>
                        <span className="ml-4">Status: {connectionStatus}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="mb-2 text-lg font-medium">Local Video</h3>
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full border rounded-lg bg-black"
                            />
                        </div>
                        <div>
                            <h3 className="mb-2 text-lg font-medium">Remote Video</h3>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full border rounded-lg bg-black"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}