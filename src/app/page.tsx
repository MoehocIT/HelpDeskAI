"use client";

import { useEffect, useMemo, useState } from "react";

type Ticket = {
  id: string;
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved";
  owner: string;
  date: string;
};

type ApiTicket = {
  ticketId: string;
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  assignedTeam?: string;
  status?: string;
  createdAt?: string;
};

function mapApiTicket(raw: ApiTicket): Ticket {
  const allowedPriority = ["High", "Medium", "Low"];
  const allowedStatus = ["Open", "In Progress", "Resolved"];
  const priority = allowedPriority.includes(raw.priority || "") ? raw.priority as Ticket["priority"] : "Medium";
  const status = allowedStatus.includes(raw.status || "") ? raw.status as Ticket["status"] : "Open";
  const date = raw.createdAt ? new Date(raw.createdAt).toLocaleDateString("vi-VN") : "—";
  return { id: raw.ticketId, title: raw.title, category: raw.category || "Unassigned", priority, status, owner: raw.assignedTeam || "IT General", date };
}

const navItems = [
  { id: "overview", icon: "▦", label: "Tổng quan" },
  { id: "chat", icon: "✳", label: "Trợ lý AI" },
  { id: "tickets", icon: "▤", label: "Quản lý ticket" },
  { id: "knowledge", icon: "▧", label: "Kho kiến thức" },
] as const;

type Page = typeof navItems[number]["id"];

export default function Home() {
  const [page, setPage] = useState<Page>("overview");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: "ai" | "user"; text: string }[]>([
    { role: "ai", text: "Xin chào! Mình là HelpMate AI. Bạn đang gặp vấn đề CNTT gì? Mình sẽ giúp bạn kiểm tra từng bước." },
  ]);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [toast, setToast] = useState("");

  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Không thể tải ticket.");
      setTickets((result.data as ApiTicket[]).map(mapApiTicket));
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Không thể kết nối API ticket.");
    } finally {
      setTicketsLoading(false);
    }
  }

  useEffect(() => { void loadTickets(); }, []);

  const visibleTickets = useMemo(() => tickets.filter((t) => {
    const matchesQuery = `${t.id} ${t.title} ${t.owner} ${t.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "All" || t.status === filter;
    return matchesQuery && matchesFilter;
  }), [tickets, query, filter]);

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }

  function sendMessage(text = chatInput) {
    const value = text.trim();
    if (!value) return;
    setMessages((old) => [...old, { role: "user", text: value }]);
    setChatInput("");
    // Demo fallback. Replace this block with a fetch call to your backend chat endpoint.
    window.setTimeout(() => {
      const lower = value.toLowerCase();
      let answer = "Mình đã ghi nhận mô tả. Bạn thử khởi động lại ứng dụng liên quan và kiểm tra xem lỗi còn xuất hiện không nhé. Nếu vẫn chưa được, hãy tạo ticket để đội IT hỗ trợ.";
      if (lower.includes("wifi") || lower.includes("mạng") || lower.includes("internet")) answer = "Bạn thử lần lượt: 1) Tắt/bật Wi-Fi; 2) kiểm tra chế độ máy bay; 3) quên mạng rồi kết nối lại; 4) khởi động router nếu bạn có quyền. Nếu nhiều thiết bị cùng lỗi, có thể mạng đang gặp sự cố.";
      else if (lower.includes("mật khẩu") || lower.includes("đăng nhập") || lower.includes("account")) answer = "Hãy kiểm tra Caps Lock và đúng tên tài khoản trước. Nếu vẫn thất bại, dùng chức năng khôi phục mật khẩu chính thức. Đừng gửi mật khẩu hoặc mã OTP cho bất kỳ ai.";
      else if (lower.includes("chậm") || lower.includes("lag")) answer = "Bạn có thể mở Task Manager để kiểm tra CPU/RAM, đóng ứng dụng không dùng và kiểm tra dung lượng ổ đĩa. Nếu máy nóng hoặc quạt chạy mạnh liên tục, hãy ghi lại hiện tượng để đội IT kiểm tra.";
      setMessages((old) => [...old, { role: "ai", text: answer }]);
    }, 500);
  }

  async function createTicket() {
    if (!newTitle.trim() || !newDescription.trim()) {
      notify("Vui lòng nhập tiêu đề và mô tả chi tiết.");
      return;
    }
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Tạo ticket thất bại.");
      await loadTickets();
      setShowNewTicket(false);
      setNewTitle("");
      setNewDescription("");
      setPage("tickets");
      notify(`Đã tạo ticket ${result.data.ticketId}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không thể tạo ticket. Kiểm tra kết nối MongoDB.");
    }
  }

  async function updateTicketStatus(ticketId: string, status: Ticket["status"]) {
    const previousTickets = tickets;
    setTickets(old => old.map(ticket => ticket.id === ticketId ? { ...ticket, status } : ticket));
    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Cập nhật trạng thái thất bại.");
      notify("Đã cập nhật trạng thái ticket.");
    } catch (error) {
      setTickets(previousTickets);
      notify(error instanceof Error ? error.message : "Không thể cập nhật ticket.");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">✳</div>
          <div><strong>help<span>mate</span></strong><small>AI IT HELPDESK</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "tickets" && <span className="nav-count">{tickets.filter((t) => t.status !== "Resolved").length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-card-icon">✦</div>
            <strong>Cần trợ giúp?</strong>
            <p>Để AI hướng dẫn bạn xử lý sự cố nhanh hơn.</p>
            <button onClick={() => setPage("chat")}>Bắt đầu trò chuyện <span>↗</span></button>
          </div>
          <div className="user-profile">
            <div className="avatar">MP</div>
            <div className="user-info"><strong>Mai Phương</strong><span>Nhân viên</span></div>
            <button className="more-button" aria-label="Tùy chọn">···</button>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{navItems.find((n) => n.id === page)?.label}</strong></div>
          <div className="top-actions">
            <span className="system-status"><i /> Hệ thống hoạt động</span>
            <button className="icon-button" aria-label="Thông báo" onClick={() => notify("Bạn đã xem các thông báo mới.")}>♧<i className="notification-dot" /></button>
            <div className="top-avatar">MP</div>
          </div>
        </header>

        <div className="content">
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow">THỨ SÁU, 09 THÁNG 10, 2026</div><h1>Chào buổi tối, Phương <span className="wave">✦</span></h1><p>Đây là tình hình hỗ trợ CNTT của bạn hôm nay.</p></div>
                <button className="primary-button" onClick={() => setShowNewTicket(true)}><span>＋</span> Tạo ticket mới</button>
              </div>
              <div className="stats-grid">
                <StatCard label="Tổng ticket" value={String(tickets.length)} change="Từ cơ sở dữ liệu" icon="▤" tone="violet" note="từ MongoDB" />
                <StatCard label="Đang mở" value={String(tickets.filter(t => t.status === "Open").length)} change="Cần xử lý" icon="◷" tone="orange" note="ticket đang chờ" />
                <StatCard label="Đang xử lý" value={String(tickets.filter(t => t.status === "In Progress").length)} change="Đang thực hiện" icon="⟳" tone="blue" note="bởi đội IT" />
                <StatCard label="Đã giải quyết" value={String(tickets.filter(t => t.status === "Resolved").length)} change="Hoàn tất" icon="✓" tone="green" note="ticket hoàn tất" />
              </div>

              <div className="dashboard-grid">
                <section className="panel ticket-panel">
                  <div className="panel-heading"><div><h2>Ticket gần đây</h2><p>Theo dõi các yêu cầu hỗ trợ mới nhất</p></div><button className="text-button" onClick={() => setPage("tickets")}>Xem tất cả <span>→</span></button></div>
                  {apiError && <div className="api-error">{apiError} — hãy kiểm tra file .env.local và MongoDB.</div>}
                  <div className="ticket-table-wrap">
                    <table className="ticket-table"><thead><tr><th>MÃ TICKET / VẤN ĐỀ</th><th>ƯU TIÊN</th><th>TRẠNG THÁI</th><th>NGƯỜI GỬI</th></tr></thead>
                      <tbody>{ticketsLoading ? <tr><td colSpan={4} className="empty-state">Đang tải ticket...</td></tr> : tickets.slice(0, 4).map(t => <tr key={t.id} onClick={() => { setPage("tickets"); setQuery(t.id); }}><td><strong>{t.id}</strong><span className="ticket-title">{t.title}</span></td><td><Priority priority={t.priority} /></td><td><Status status={t.status} /></td><td><div className="person-cell"><span className="mini-avatar">{t.owner.slice(0,1)}</span>{t.owner}</div></td></tr>)}</tbody>
                    </table>
                  </div>
                </section>
                <section className="panel assistant-panel">
                  <div className="assistant-top"><div className="ai-orb">✳</div><div><span className="online-label"><i /> AI ASSISTANT ONLINE</span><h2>HelpMate AI</h2><p>Trợ lý kỹ thuật của bạn</p></div><span className="sparkle">✧</span></div>
                  <div className="assistant-message">Xin chào Phương! 👋<br /><br />Mình có thể giúp bạn chẩn đoán lỗi, tìm hướng dẫn hoặc tạo ticket hỗ trợ.</div>
                  <div className="suggestion-label">BẠN CẦN GIÚP GÌ?</div>
                  <button className="suggestion" onClick={() => { setPage("chat"); sendMessage("Máy tính của tôi không kết nối được Wi-Fi"); }}>⌁ <span>Khắc phục lỗi Wi-Fi</span><b>↗</b></button>
                  <button className="suggestion" onClick={() => { setPage("chat"); sendMessage("Tôi không thể đăng nhập tài khoản"); }}>♙ <span>Vấn đề tài khoản</span><b>↗</b></button>
                  <button className="suggestion" onClick={() => setPage("chat")}>＋ <span>Mô tả sự cố khác</span><b>↗</b></button>
                  <button className="chat-cta" onClick={() => setPage("chat")}>Trò chuyện với AI <span>→</span></button>
                </section>
              </div>
              <section className="panel knowledge-panel">
                <div className="panel-heading"><div><h2>Kiến thức nổi bật</h2><p>Hướng dẫn xử lý nhanh các vấn đề thường gặp</p></div><button className="text-button" onClick={() => setPage("knowledge")}>Khám phá kho kiến thức <span>→</span></button></div>
                <div className="knowledge-grid">
                  <KnowledgeCard icon="⌁" category="MẠNG & KẾT NỐI" title="Khắc phục sự cố Wi-Fi" desc="Các bước kiểm tra khi thiết bị không thể kết nối mạng." color="blue" onClick={() => setPage("knowledge")} />
                  <KnowledgeCard icon="♙" category="TÀI KHOẢN" title="Khôi phục quyền truy cập" desc="Xử lý lỗi đăng nhập và quên mật khẩu an toàn." color="purple" onClick={() => setPage("knowledge")} />
                  <KnowledgeCard icon="▣" category="HIỆU NĂNG" title="Tối ưu máy tính chậm" desc="Kiểm tra ứng dụng nền và tài nguyên hệ thống." color="orange" onClick={() => setPage("knowledge")} />
                </div>
              </section>
            </>
          )}

          {page === "tickets" && (
            <>
              <div className="page-heading"><div><div className="eyebrow">SUPPORT CENTER</div><h1>Quản lý ticket</h1><p>Theo dõi và quản lý tất cả yêu cầu hỗ trợ CNTT.</p></div><button className="primary-button" onClick={() => setShowNewTicket(true)}>＋ Tạo ticket mới</button></div>
              <section className="panel ticket-list-panel">
                {apiError && <div className="api-error">{apiError} — hãy kiểm tra file .env.local và MongoDB.</div>}
                <div className="list-toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo mã, vấn đề, người gửi..." /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="All">Tất cả trạng thái</option><option>Open</option><option>In Progress</option><option>Resolved</option></select></div>
                <div className="ticket-table-wrap"><table className="ticket-table full-table"><thead><tr><th>MÃ TICKET / VẤN ĐỀ</th><th>PHÂN LOẠI</th><th>ƯU TIÊN</th><th>TRẠNG THÁI</th><th>NGƯỜI GỬI</th><th>NGÀY TẠO</th></tr></thead><tbody>
                  {ticketsLoading ? <tr><td colSpan={6} className="empty-state">Đang tải ticket...</td></tr> : visibleTickets.map(t => <tr key={t.id}><td><strong>{t.id}</strong><span className="ticket-title">{t.title}</span></td><td>{t.category}</td><td><Priority priority={t.priority} /></td><td><select className="status-select" value={t.status} onChange={e => void updateTicketStatus(t.id, e.target.value as Ticket["status"])}><option>Open</option><option>In Progress</option><option>Resolved</option></select></td><td>{t.owner}</td><td>{t.date}</td></tr>)}
                  {!ticketsLoading && visibleTickets.length === 0 && <tr><td colSpan={6} className="empty-state">Không tìm thấy ticket phù hợp.</td></tr>}
                </tbody></table></div>
                <div className="table-footer">Hiển thị {visibleTickets.length} trên {tickets.length} ticket <span>Đồng bộ API · MongoDB</span></div>
              </section>
            </>
          )}

          {page === "chat" && (
            <>
              <div className="page-heading"><div><div className="eyebrow">AI-POWERED SUPPORT</div><h1>Trợ lý AI</h1><p>Mô tả vấn đề của bạn — cùng tìm giải pháp từng bước.</p></div><span className="system-status"><i /> Đang trực tuyến</span></div>
              <section className="chat-layout panel">
                <div className="chat-header"><div className="ai-orb small-orb">✳</div><div><strong>HelpMate AI</strong><span><i /> Sẵn sàng hỗ trợ bạn</span></div><button className="text-button" onClick={() => setMessages([{role:"ai", text:"Cuộc trò chuyện mới bắt đầu. Bạn đang gặp vấn đề CNTT gì?"}])}>＋ Cuộc trò chuyện mới</button></div>
                <div className="chat-messages">{messages.map((m, i) => <div key={i} className={`message-row ${m.role === "user" ? "user-row" : ""}`}>{m.role === "ai" && <div className="message-avatar">✳</div>}<div className={`message-bubble ${m.role}`}>{m.text}</div>{m.role === "user" && <div className="message-avatar user-message-avatar">MP</div>}</div>)}</div>
                <div className="chat-prompts"><button onClick={() => sendMessage("Máy tính không kết nối được Wi-Fi")}>⌁ Lỗi Wi-Fi</button><button onClick={() => sendMessage("Tôi quên mật khẩu tài khoản")}>♙ Tài khoản</button><button onClick={() => setShowNewTicket(true)}>＋ Tạo ticket</button></div>
                <form className="chat-composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Mô tả vấn đề bạn đang gặp..." /><button className="send-button" type="submit" aria-label="Gửi tin nhắn">↑</button></form>
                <p className="chat-disclaimer">AI có thể đưa ra gợi ý chưa chính xác. Không chia sẻ mật khẩu hoặc thông tin nhạy cảm.</p>
              </section>
            </>
          )}

          {page === "knowledge" && (
            <>
              <div className="page-heading"><div><div className="eyebrow">SELF-SERVICE CENTER</div><h1>Kho kiến thức</h1><p>Hướng dẫn thực tế giúp bạn tự xử lý các sự cố CNTT phổ biến.</p></div></div>
              <div className="knowledge-hero"><div><span className="online-label">✦ KNOWLEDGE BASE</span><h2>Tìm câu trả lời, nhanh hơn.</h2><p>Khám phá hướng dẫn và giải pháp từ đội ngũ IT.</p><div className="hero-search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Bạn đang cần hỗ trợ điều gì?" /></div></div><div className="hero-art">✳<span>⌁</span><i>✦</i></div></div>
              <div className="section-title"><h2>Danh mục hướng dẫn</h2><span>03 danh mục</span></div>
              <div className="knowledge-grid large-knowledge">
                <KnowledgeCard icon="⌁" category="MẠNG & KẾT NỐI" title="Khắc phục sự cố Wi-Fi" desc="Kiểm tra kết nối, DNS, router và cấu hình mạng." color="blue" onClick={() => notify("Đang mở hướng dẫn Wi-Fi (bản demo).")} />
                <KnowledgeCard icon="♙" category="TÀI KHOẢN" title="Đăng nhập & mật khẩu" desc="Khôi phục tài khoản và xử lý lỗi xác thực." color="purple" onClick={() => notify("Đang mở hướng dẫn tài khoản (bản demo).")} />
                <KnowledgeCard icon="▣" category="HIỆU NĂNG" title="Máy tính chạy chậm" desc="Kiểm tra bộ nhớ, ứng dụng nền và dung lượng." color="orange" onClick={() => notify("Đang mở hướng dẫn hiệu năng (bản demo).")} />
                <KnowledgeCard icon="▧" category="PHẦN MỀM" title="Cài đặt phần mềm" desc="Các bước cài đặt và xử lý lỗi ứng dụng cơ bản." color="green" onClick={() => notify("Đang mở hướng dẫn phần mềm (bản demo).")} />
                <KnowledgeCard icon="▤" category="PHẦN CỨNG" title="Thiết bị ngoại vi" desc="Xử lý sự cố máy in, bàn phím và màn hình." color="orange" onClick={() => notify("Đang mở hướng dẫn phần cứng (bản demo).")} />
                <KnowledgeCard icon="◇" category="BẢO MẬT" title="An toàn tài khoản" desc="Nhận biết dấu hiệu đáng ngờ và báo cáo sự cố." color="purple" onClick={() => notify("Đang mở hướng dẫn bảo mật (bản demo).")} />
              </div>
            </>
          )}
          <footer className="footer"><span>© 2026 HelpMate AI · IT Support Workspace</span><span>Được thiết kế để hỗ trợ bạn tốt hơn <b>✳</b></span></footer>
        </div>
      </section>

      {showNewTicket && <div className="modal-backdrop" onClick={() => setShowNewTicket(false)}><form className="ticket-modal" onClick={e => e.stopPropagation()} onSubmit={e => {e.preventDefault(); createTicket();}}><button type="button" className="modal-close" onClick={() => setShowNewTicket(false)}>×</button><div className="modal-icon">＋</div><h2>Tạo ticket hỗ trợ</h2><p>Mô tả vấn đề để đội IT có thể hỗ trợ bạn.</p><label>Tiêu đề sự cố <span>*</span><input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ví dụ: Không thể kết nối Wi-Fi" /></label><label>Mô tả chi tiết <span>*</span><textarea required value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Bạn đã thử những cách nào? Lỗi xuất hiện từ khi nào?" rows={4} /></label><div className="modal-note">✦ Ticket sẽ được lưu vào MongoDB. Nếu cấu hình N8N_WEBHOOK_URL, hệ thống cũng gửi sự kiện đến n8n.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowNewTicket(false)}>Hủy</button><button type="submit" className="primary-button">Tạo ticket <span>→</span></button></div></form></div>}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function StatCard({ label, value, change, icon, tone, note }: { label: string; value: string; change: string; icon: string; tone: string; note: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><div className="stat-foot"><span className={tone === "orange" ? "orange-text" : "green-text"}>{change}</span><span>{note}</span></div></div>;
}

function Priority({ priority }: { priority: Ticket["priority"] }) {
  const labels = {
    High: "Cao",
    Medium: "Trung bình",
    Low: "Thấp",
  };

  return (
    <span className={`priority priority-${priority.toLowerCase()}`}>
      <i />
      {labels[priority]}
    </span>
  );
}

function Status({ status }: { status: Ticket["status"] }) {
  return <span className={`status status-${status.toLowerCase().replace(" ", "-")}`}><i />{status === "Open" ? "Đang mở" : status === "In Progress" ? "Đang xử lý" : "Đã giải quyết"}</span>;
}
function KnowledgeCard({ icon, category, title, desc, color, onClick }: { icon: string; category: string; title: string; desc: string; color: string; onClick: () => void }) {
  return <button className="knowledge-card" onClick={onClick}><div className={`knowledge-icon ${color}`}>{icon}</div><span className="knowledge-category">{category}</span><h3>{title}</h3><p>{desc}</p><span className="knowledge-link">Đọc hướng dẫn <b>↗</b></span></button>;
}
