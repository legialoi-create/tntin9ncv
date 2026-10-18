export const SEED_APP_DATA = {
  "exams": [
    {
      "id": "exam-thu-ncv",
      "code": "THU",
      "title": "Bài kiểm tra thử nghiệm Tin học - THCS Nam Cửa Việt",
      "grade": 9,
      "targetClasses": ["THU", "9A8", "9A9", "9A", "9B", "9C", "8A", "7A", "6A"],
      "durationMinutes": 45,
      "totalPoints": 10,
      "isOpen": true,
      "maxAttempts": 5,
      "maxViolationsBeforeLock": 3,
      "shuffleQuestions": true,
      "shuffleOptions": true,
      "showScoreAfterSubmit": true,
      "questions": [
        {
          "id": "q1",
          "number": 1,
          "content": "Trong phần mềm lập trình Scratch, khối lệnh nào dùng để thực hiện việc lặp lại một chuỗi hành động với số lần định trước?",
          "options": [
            { "id": "A", "text": "Khối lệnh repeat (lặp)" },
            { "id": "B", "text": "Khối lệnh forever (liên tục)" },
            { "id": "C", "text": "Khối lệnh if...then (nếu...thì)" },
            { "id": "D", "text": "Khối lệnh wait until (chờ cho đến khi)" }
          ],
          "correctAnswer": "A",
          "explanation": "Khối lệnh repeat cho phép lặp lại công việc với số lần xác định trước."
        },
        {
          "id": "q2",
          "number": 2,
          "content": "Mạng máy tính là gì?",
          "options": [
            { "id": "A", "text": "Tập hợp các máy tính nối kết với nhau theo một phương thức nào đó để chia sẻ tài nguyên" },
            { "id": "B", "text": "Tập hợp các máy tính hoạt động độc lập không kết nối với nhau" },
            { "id": "C", "text": "Nơi lưu trữ phần mềm máy tính" },
            { "id": "D", "text": "Dịch vụ giải trí trên Internet" }
          ],
          "correctAnswer": "A",
          "explanation": "Mạng máy tính là tập hợp các máy tính kết nối với nhau để chia sẻ dữ liệu và thiết bị."
        },
        {
          "id": "q3",
          "number": 3,
          "content": "Địa chỉ Email nào sau đây là hợp lệ?",
          "options": [
            { "id": "A", "text": "legialoi@gmail.com" },
            { "id": "B", "text": "legialoi#gmail.com" },
            { "id": "C", "text": "legialoi.gmail.com" },
            { "id": "D", "text": "legialoi@gmail@com" }
          ],
          "correctAnswer": "A",
          "explanation": "Địa chỉ email hợp lệ có cấu trúc [TênTàiKhoản]@[TênMiền]."
        },
        {
          "id": "q4",
          "number": 4,
          "content": "Trình duyệt web phổ biến hiện nay dùng để truy cập Internet là gì?",
          "options": [
            { "id": "A", "text": "Google Chrome, Microsoft Edge, Mozilla Firefox" },
            { "id": "B", "text": "Microsoft Word, Excel, PowerPoint" },
            { "id": "C", "text": "Pascal, C++, Python" },
            { "id": "D", "text": "Photoshop, Paint, Unikey" }
          ],
          "correctAnswer": "A",
          "explanation": "Chrome, Edge, Firefox là các phần mềm trình duyệt web."
        },
        {
          "id": "q5",
          "number": 5,
          "content": "Trong bảng tính Excel, để tính tổng các ô từ A1 đến A10 ta dùng hàm nào?",
          "options": [
            { "id": "A", "text": "=SUM(A1:A10)" },
            { "id": "B", "text": "=AVERAGE(A1:A10)" },
            { "id": "C", "text": "=COUNT(A1:A10)" },
            { "id": "D", "text": "=MAX(A1:A10)" }
          ],
          "correctAnswer": "A",
          "explanation": "Hàm SUM dùng để tính tổng chuỗi dữ liệu trong dải ô."
        }
      ]
    },
    {
      "id": "exam-1791604725287",
      "code": "TIN9-NCV01",
      "title": "Kiểm tra 1 tiết Tin học 9 - Đề chính thức THCS Nam Cửa Việt",
      "grade": 9,
      "targetClasses": ["9A8", "9A9", "9A", "9B", "9C", "THU"],
      "durationMinutes": 45,
      "totalPoints": 10,
      "isOpen": true,
      "maxAttempts": 2,
      "maxViolationsBeforeLock": 3,
      "shuffleQuestions": true,
      "shuffleOptions": true,
      "showScoreAfterSubmit": true,
      "questions": [
        {
          "id": "q_tin9_1",
          "number": 1,
          "content": "Mạng máy tính bao gồm các thành phần cơ bản nào sau đây?",
          "options": [
            { "id": "A", "text": "Các thiết bị đầu cuối, môi trường truyền dẫn, các thiết bị kết nối mạng và phần mềm mạng" },
            { "id": "B", "text": "Chỉ gồm máy tính để bàn và dây cáp mạng" },
            { "id": "C", "text": "Màn hình, bàn phím, chuột và thùng máy" },
            { "id": "D", "text": "Máy in, máy quét, ổ đĩa USB" }
          ],
          "correctAnswer": "A",
          "explanation": "Các thành phần cơ bản của mạng máy tính gồm: Thiết bị đầu cuối, môi trường truyền, thiết bị kết nối và phần mềm mạng."
        },
        {
          "id": "q_tin9_2",
          "number": 2,
          "content": "Mạng LAN (Local Area Network) là loại mạng nào?",
          "options": [
            { "id": "A", "text": "Mạng cục bộ kết nối các máy tính trong một phạm vi nhỏ như phòng học, trường học, văn phòng" },
            { "id": "B", "text": "Mạng diện rộng kết nối máy tính toàn cầu" },
            { "id": "C", "text": "Mạng đô thị bao phủ cả một thành phố" },
            { "id": "D", "text": "Mạng không dây cá nhân trong khoảng cách 1 mét" }
          ],
          "correctAnswer": "A",
          "explanation": "Mạng LAN kết nối máy tính trong phạm vi địa lý hẹp như trường học, văn phòng."
        },
        {
          "id": "q_tin9_3",
          "number": 3,
          "content": "Internet là gì?",
          "options": [
            { "id": "A", "text": "Hệ thống thông tin toàn cầu kết nối hàng triệu mạng máy tính trên thế giới" },
            { "id": "B", "text": "Một phần mềm soạn thảo văn bản của Microsoft" },
            { "id": "C", "text": "Mạng máy tính nội bộ của trường THCS Nam Cửa Việt" },
            { "id": "D", "text": "Chương trình diệt virus tự động" }
          ],
          "correctAnswer": "A",
          "explanation": "Internet là mạng toàn cầu liên kết các mạng máy tính lại với nhau."
        },
        {
          "id": "q_tin9_4",
          "number": 4,
          "content": "Trang web chứa thông tin dạng gì?",
          "options": [
            { "id": "A", "text": "Văn bản, hình ảnh, âm thanh, video và các liên kết siêu văn bản (Hyperlink)" },
            { "id": "B", "text": "Chỉ chứa chữ viết không có hình ảnh" },
            { "id": "C", "text": "Chỉ chứa mã lệnh máy tính" },
            { "id": "D", "text": "Chỉ có tập tin âm thanh MP3" }
          ],
          "correctAnswer": "A",
          "explanation": "Trang web chứa đa phương tiện và siêu liên kết liên kết tới các trang khác."
        },
        {
          "id": "q_tin9_5",
          "number": 5,
          "content": "Khi tìm kiếm thông tin trên Internet bằng Google, từ khóa nên được đặt như thế nào để kết quả chính xác nhất?",
          "options": [
            { "id": "A", "text": "Ngắn gọn, rõ ràng, thể hiện đúng nội dung cần tìm, có thể đặt trong dấu ngoặc đôi \"\"" },
            { "id": "B", "text": "Viết nguyên một đoạn văn dài có cả lời chào hỏi" },
            { "id": "C", "text": "Chỉ gõ 1 chữ cái duy nhất" },
            { "id": "D", "text": "Gõ câu hỏi không liên quan đến chủ đề" }
          ],
          "correctAnswer": "A",
          "explanation": "Từ khóa ngắn gọn, đúng trọng tâm giúp máy tìm kiếm lọc dữ liệu nhanh và chính xác."
        },
        {
          "id": "q_tin9_6",
          "number": 6,
          "content": "Thư điện tử (Email) có ưu điểm vượt trội nào so với thư bưu điện truyền thống?",
          "options": [
            { "id": "A", "text": "Tốc độ gửi nhận cực nhanh (gần như tức thì), chi phí thấp, gửi đồng thời cho nhiều người" },
            { "id": "B", "text": "Cần phải có tem thư dán ngoài bao thư" },
            { "id": "C", "text": "Mất từ 3 đến 5 ngày mới đến tay người nhận" },
            { "id": "D", "text": "Chỉ gửi được vào giờ hành chính" }
          ],
          "correctAnswer": "A",
          "explanation": "Email truyền đi tức thời trên toàn cầu với chi phí rất rẻ."
        },
        {
          "id": "q_tin9_7",
          "number": 7,
          "content": "Trong địa chỉ Email `truongncv@gmail.com`, phần tên miền dịch vụ cung cấp thư là gì?",
          "options": [
            { "id": "A", "text": "gmail.com" },
            { "id": "B", "text": "truongncv" },
            { "id": "C", "text": "@" },
            { "id": "D", "text": "truongncv@gmail" }
          ],
          "correctAnswer": "A",
          "explanation": "Tên miền đứng sau ký tự @ trong địa chỉ email."
        },
        {
          "id": "q_tin9_8",
          "number": 8,
          "content": "Tác hại của tin nhắn rác, thư lừa đảo (Phishing) trên mạng là gì?",
          "options": [
            { "id": "A", "text": "Đánh cắp thông tin cá nhân, tài khoản ngân hàng và phát tán mã độc" },
            { "id": "B", "text": "Tăng tốc độ kết nối Internet của máy tính" },
            { "id": "C", "text": "Giúp máy tính chạy mát hơn" },
            { "id": "D", "text": "Tự động sao lưu dữ liệu quan trọng" }
          ],
          "correctAnswer": "A",
          "explanation": "Thư rác/lừa đảo đánh cắp tài khoản và lây nhiễm virus độc hại."
        },
        {
          "id": "q_tin9_9",
          "number": 9,
          "content": "Mật khẩu an toàn cho tài khoản cá nhân nên bao gồm những yếu tố nào?",
          "options": [
            { "id": "A", "text": "Độ dài từ 8 ký tự trở lên, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt" },
            { "id": "B", "text": "Chỉ gồm ngày tháng năm sinh của bản thân" },
            { "id": "C", "text": "Mật khẩu đơn giản như 123456 hoặc 111111" },
            { "id": "D", "text": "Tên đăng nhập trùng hoàn toàn với mật khẩu" }
          ],
          "correctAnswer": "A",
          "explanation": "Mật khẩu mạnh kết hợp nhiều loại ký tự để tránh bị dò quét."
        },
        {
          "id": "q_tin9_10",
          "number": 10,
          "content": "Trong phần mềm trình chiếu PowerPoint, thao tác nào dùng để tạo một trang chiếu mới?",
          "options": [
            { "id": "A", "text": "Bấm tổ hợp phím Ctrl + M hoặc nút New Slide" },
            { "id": "B", "text": "Bấm tổ hợp phím Ctrl + N" },
            { "id": "C", "text": "Bấm phím F5" },
            { "id": "D", "text": "Bấm phím Delete" }
          ],
          "correctAnswer": "A",
          "explanation": "Ctrl + M dùng để chèn thêm slide mới trong PowerPoint."
        }
      ]
    }
  ],
  "classes": [
    { "name": "THU", "grade": 9, "studentCount": 10 },
    { "name": "9A8", "grade": 9, "studentCount": 38 },
    { "name": "9A9", "grade": 9, "studentCount": 40 },
    { "name": "9A", "grade": 9, "studentCount": 36 },
    { "name": "9B", "grade": 9, "studentCount": 35 },
    { "name": "9C", "grade": 9, "studentCount": 35 },
    { "name": "8A", "grade": 8, "studentCount": 38 },
    { "name": "8B", "grade": 8, "studentCount": 37 },
    { "name": "8C", "grade": 8, "studentCount": 36 },
    { "name": "7A", "grade": 7, "studentCount": 36 },
    { "name": "7B", "grade": 7, "studentCount": 35 },
    { "name": "7C", "grade": 7, "studentCount": 34 },
    { "name": "6A", "grade": 6, "studentCount": 35 },
    { "name": "6B", "grade": 6, "studentCount": 34 },
    { "name": "6C", "grade": 6, "studentCount": 33 }
  ],
  "students": [
    {
      "id": "st-thu-1",
      "name": "Lê Gia Lợi",
      "class": "THU",
      "sbd": "THU-01",
      "username": "gialoithu",
      "password": "THU123",
      "isPasswordChanged": false
    },
    {
      "id": "st-thu-2",
      "name": "Học Sinh Thử Nghiệm 1",
      "class": "THU",
      "sbd": "THU-02",
      "username": "nghiemthu1",
      "password": "THU123",
      "isPasswordChanged": false
    }
  ],
  "sessions": []
};
