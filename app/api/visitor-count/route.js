import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import VisitorCount from '../../../models/VisitorCount';

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
};

export async function GET() {
  try {
    await connectToMongo();

    let visitorDoc = await VisitorCount.findById('visitor-counter');

    if (!visitorDoc) {
      visitorDoc = await VisitorCount.create({
        _id: 'visitor-counter',
        count: 0,
      });
    }

    visitorDoc.count += 1;
    visitorDoc.lastUpdated = new Date();
    await visitorDoc.save();

    return NextResponse.json({ count: visitorDoc.count });
  } catch (error) {
    console.error('Error in visitor-count:', error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}