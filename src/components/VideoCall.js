import { useRef, useState, useEffect } from "react";
// import io from "socket.io-client";

const VideoCall = () => {
    const [socket, setSocket] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);

    const ICE_SERVERS = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }, // STUN server
        ],
    };

    useEffect(() => {
        const socket = new WebSocket("ws://localhost:8000/ws");
        setSocket(socket);

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.sdp) {
                peerConnection.current.setRemoteDescription(
                    new RTCSessionDescription(message.sdp)
                );
                if (message.sdp.type === "offer") {
                    peerConnection.current
                        .createAnswer()
                        .then((answer) => peerConnection.current.setLocalDescription(answer))
                        .then(() => {
                            socket.send(
                                JSON.stringify({ sdp: peerConnection.current.localDescription })
                            );
                        });
                }
            } else if (message.candidate) {
                peerConnection.current.addIceCandidate(
                    new RTCIceCandidate(message.candidate)
                );
            }
        };

        // Cleanup on component unmount
        return () => {
            socket.close();
        };
    }, []);

    const startCall = async () => {
        peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({ candidate: event.candidate }));
            }
        };

        peerConnection.current.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        localVideoRef.current.srcObject = stream;

        stream.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, stream);
        });

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        socket.send(JSON.stringify({ sdp: peerConnection.current.localDescription }));
    };

    return (
        <div>
            <video ref={localVideoRef} autoPlay playsInline muted />
            <video ref={remoteVideoRef} autoPlay playsInline />
            <button onClick={startCall}>Start Call</button>
        </div>
    );
};

export default VideoCall;
