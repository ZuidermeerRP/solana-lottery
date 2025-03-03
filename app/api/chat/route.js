// app/api/chat/route.js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import ChatMessage from '../../../models/ChatMessage';

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    } catch (error) {
      throw new Error('Failed to connect to MongoDB: ' + error.message);
    }
  }
};

export async function GET() {
  try {
    await connectToMongo();
    const messages = await ChatMessage.find().sort({ timestamp: -1 }).limit(50); // Last 50 messages
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToMongo();
    const { username, message, walletAddress } = await request.json();
    if (!username || !message || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const newMessage = new ChatMessage({ username, message, walletAddress });
    await newMessage.save();
    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error('Error saving chat message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}