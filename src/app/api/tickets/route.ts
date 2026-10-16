
import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Ticket from '../../../models/Ticket';

type Priority = 'Low' | 'Medium' | 'High';

type Classification = {
  category: string;
  priority: Priority;
  assignedTeam: string;
};

/**
 * Phân loại ban đầu bằng quy tắc từ khóa.
 * Đây chưa phải mô hình AI ngôn ngữ lớn.
 * Có thể thay hàm này bằng dịch vụ AI thật sau.
 */
function classifyTicket(
  title: string,
  description: string
): Classification {
  const text = `${title} ${description}`
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  const highImpactKeywords = [
    'toan bo cong ty',
    'tat ca nguoi dung',
    'nhieu nguoi dung',
    'server down',
    'he thong ngung',
    'khong the lam viec',
    'mat du lieu',
    'bao mat',
    'bi tan cong',
    'ro ri du lieu',
  ];

  const networkKeywords = [
    'mang',
    'wifi',
    'wi-fi',
    'internet',
    'ket noi',
    'khong vao duoc web',
    'mat ket noi',
    'duong truyen',
    'router',
    'dns',
  ];

  const hardwareKeywords = [
    'may hu',
    'phan cung',
    'man hinh',
    'ban phim',
    'chuot',
    'may tinh khong len',
    'khong khoi dong',
    'pin',
    'o cung',
  ];

  const softwareKeywords = [
    'phan mem',
    'cai dat',
    'ung dung',
    'loi phan mem',
    'khong mo duoc',
    'windows',
    'driver',
    'trinh duyet',
  ];

  const accessKeywords = [
    'cap quyen',
    'quyen truy cap',
    'tai khoan',
    'dang nhap',
    'mat khau',
    'phan quyen',
    'khoa tai khoan',
  ];

  const containsAny = (keywords: string[]) =>
    keywords.some((keyword) => text.includes(keyword));

  let category = 'general';
  let assignedTeam = 'IT General';

  if (containsAny(accessKeywords)) {
    category = 'access';
    assignedTeam = 'IT Support';
  } else if (containsAny(networkKeywords)) {
    category = 'network';
    assignedTeam = 'IT Network';
  } else if (containsAny(hardwareKeywords)) {
    category = 'hardware';
    assignedTeam = 'IT Hardware';
  } else if (containsAny(softwareKeywords)) {
    category = 'software';
    assignedTeam = 'IT Support';
  }

  let priority: Priority = 'Medium';

  if (containsAny(highImpactKeywords)) {
    priority = 'High';
  } else if (
    text.includes('cham') ||
    text.includes('hoi dap') ||
    text.includes('huong dan') ||
    text.includes('khong gap') ||
    text.includes('co the cho')
  ) {
    priority = 'Low';
  } else if (
    text.includes('khong hoat dong') ||
    text.includes('khong the su dung') ||
    text.includes('ngung hoat dong') ||
    text.includes('gap') ||
    text.includes('khong the dang nhap')
  ) {
    priority = 'High';
  }

  return { category, priority, assignedTeam };
}

export async function GET() {
  try {
    await connectDB();

    const tickets = await Ticket.find({}).sort({ createdAt: -1 });

    return NextResponse.json(
      { success: true, data: tickets },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Lỗi máy chủ không xác định';

    console.error('GET /api/tickets:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const title =
      typeof body.title === 'string' ? body.title.trim() : '';

    const description =
      typeof body.description === 'string'
        ? body.description.trim()
        : '';

    if (!title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tiêu đề và mô tả không được để trống',
        },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tiêu đề không được vượt quá 200 ký tự',
        },
        { status: 400 }
      );
    }

    const classification = classifyTicket(title, description);

    const ticketId = `TCK-${Math.floor(
      100000 + Math.random() * 900000
    )}`;

    const newTicket = await Ticket.create({
      ticketId,
      title,
      description,
      category: classification.category,
      priority: classification.priority,
      assignedTeam: classification.assignedTeam,
      status: 'Open',
    });

    // Gửi thông tin sang n8n nếu đã cấu hình webhook.
    // Không chờ workflow hoàn thành để tránh làm chậm việc tạo ticket.
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (n8nWebhookUrl) {
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: newTicket.ticketId,
          title: newTicket.title,
          description: newTicket.description,
          category: newTicket.category,
          priority: newTicket.priority,
          assignedTeam: newTicket.assignedTeam,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch((error: unknown) => {
        console.error('Không gửi được ticket sang n8n:', error);
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Tạo ticket thành công',
        data: newTicket,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Lỗi máy chủ không xác định';

    console.error('POST /api/tickets:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
