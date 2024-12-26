import VideoCall from "@/app/components/VideoCall";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <h1 className="text-4xl font-bold mb-8">Video Chat App</h1>
            <VideoCall />
        </main>
    );
}