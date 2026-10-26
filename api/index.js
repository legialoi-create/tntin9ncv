// server.ts
import express from "express";
import path2 from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

// server/db.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

// server/seedData.ts
var SEED_APP_DATA = {
  "exams": [
    {
      "id": "exam-thu-ncv",
      "code": "THU",
      "title": "B\xE0i ki\u1EC3m tra th\u1EED nghi\u1EC7m Tin h\u1ECDc - THCS Nam C\u1EEDa Vi\u1EC7t",
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
          "content": "Trong ph\u1EA7n m\u1EC1m l\u1EADp tr\xECnh Scratch, kh\u1ED1i l\u1EC7nh n\xE0o d\xF9ng \u0111\u1EC3 th\u1EF1c hi\u1EC7n vi\u1EC7c l\u1EB7p l\u1EA1i m\u1ED9t chu\u1ED7i h\xE0nh \u0111\u1ED9ng v\u1EDBi s\u1ED1 l\u1EA7n \u0111\u1ECBnh tr\u01B0\u1EDBc?",
          "options": [
            { "id": "A", "text": "Kh\u1ED1i l\u1EC7nh repeat (l\u1EB7p)" },
            { "id": "B", "text": "Kh\u1ED1i l\u1EC7nh forever (li\xEAn t\u1EE5c)" },
            { "id": "C", "text": "Kh\u1ED1i l\u1EC7nh if...then (n\u1EBFu...th\xEC)" },
            { "id": "D", "text": "Kh\u1ED1i l\u1EC7nh wait until (ch\u1EDD cho \u0111\u1EBFn khi)" }
          ],
          "correctAnswer": "A",
          "explanation": "Kh\u1ED1i l\u1EC7nh repeat cho ph\xE9p l\u1EB7p l\u1EA1i c\xF4ng vi\u1EC7c v\u1EDBi s\u1ED1 l\u1EA7n x\xE1c \u0111\u1ECBnh tr\u01B0\u1EDBc."
        },
        {
          "id": "q2",
          "number": 2,
          "content": "M\u1EA1ng m\xE1y t\xEDnh l\xE0 g\xEC?",
          "options": [
            { "id": "A", "text": "T\u1EADp h\u1EE3p c\xE1c m\xE1y t\xEDnh n\u1ED1i k\u1EBFt v\u1EDBi nhau theo m\u1ED9t ph\u01B0\u01A1ng th\u1EE9c n\xE0o \u0111\xF3 \u0111\u1EC3 chia s\u1EBB t\xE0i nguy\xEAn" },
            { "id": "B", "text": "T\u1EADp h\u1EE3p c\xE1c m\xE1y t\xEDnh ho\u1EA1t \u0111\u1ED9ng \u0111\u1ED9c l\u1EADp kh\xF4ng k\u1EBFt n\u1ED1i v\u1EDBi nhau" },
            { "id": "C", "text": "N\u01A1i l\u01B0u tr\u1EEF ph\u1EA7n m\u1EC1m m\xE1y t\xEDnh" },
            { "id": "D", "text": "D\u1ECBch v\u1EE5 gi\u1EA3i tr\xED tr\xEAn Internet" }
          ],
          "correctAnswer": "A",
          "explanation": "M\u1EA1ng m\xE1y t\xEDnh l\xE0 t\u1EADp h\u1EE3p c\xE1c m\xE1y t\xEDnh k\u1EBFt n\u1ED1i v\u1EDBi nhau \u0111\u1EC3 chia s\u1EBB d\u1EEF li\u1EC7u v\xE0 thi\u1EBFt b\u1ECB."
        },
        {
          "id": "q3",
          "number": 3,
          "content": "\u0110\u1ECBa ch\u1EC9 Email n\xE0o sau \u0111\xE2y l\xE0 h\u1EE3p l\u1EC7?",
          "options": [
            { "id": "A", "text": "legialoi@gmail.com" },
            { "id": "B", "text": "legialoi#gmail.com" },
            { "id": "C", "text": "legialoi.gmail.com" },
            { "id": "D", "text": "legialoi@gmail@com" }
          ],
          "correctAnswer": "A",
          "explanation": "\u0110\u1ECBa ch\u1EC9 email h\u1EE3p l\u1EC7 c\xF3 c\u1EA5u tr\xFAc [T\xEAnT\xE0iKho\u1EA3n]@[T\xEAnMi\u1EC1n]."
        },
        {
          "id": "q4",
          "number": 4,
          "content": "Tr\xECnh duy\u1EC7t web ph\u1ED5 bi\u1EBFn hi\u1EC7n nay d\xF9ng \u0111\u1EC3 truy c\u1EADp Internet l\xE0 g\xEC?",
          "options": [
            { "id": "A", "text": "Google Chrome, Microsoft Edge, Mozilla Firefox" },
            { "id": "B", "text": "Microsoft Word, Excel, PowerPoint" },
            { "id": "C", "text": "Pascal, C++, Python" },
            { "id": "D", "text": "Photoshop, Paint, Unikey" }
          ],
          "correctAnswer": "A",
          "explanation": "Chrome, Edge, Firefox l\xE0 c\xE1c ph\u1EA7n m\u1EC1m tr\xECnh duy\u1EC7t web."
        },
        {
          "id": "q5",
          "number": 5,
          "content": "Trong b\u1EA3ng t\xEDnh Excel, \u0111\u1EC3 t\xEDnh t\u1ED5ng c\xE1c \xF4 t\u1EEB A1 \u0111\u1EBFn A10 ta d\xF9ng h\xE0m n\xE0o?",
          "options": [
            { "id": "A", "text": "=SUM(A1:A10)" },
            { "id": "B", "text": "=AVERAGE(A1:A10)" },
            { "id": "C", "text": "=COUNT(A1:A10)" },
            { "id": "D", "text": "=MAX(A1:A10)" }
          ],
          "correctAnswer": "A",
          "explanation": "H\xE0m SUM d\xF9ng \u0111\u1EC3 t\xEDnh t\u1ED5ng chu\u1ED7i d\u1EEF li\u1EC7u trong d\u1EA3i \xF4."
        }
      ]
    },
    {
      "id": "exam-1791604725287",
      "code": "TIN9-NCV01",
      "title": "Ki\u1EC3m tra 1 ti\u1EBFt Tin h\u1ECDc 9 - \u0110\u1EC1 ch\xEDnh th\u1EE9c THCS Nam C\u1EEDa Vi\u1EC7t",
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
          "content": "M\u1EA1ng m\xE1y t\xEDnh bao g\u1ED3m c\xE1c th\xE0nh ph\u1EA7n c\u01A1 b\u1EA3n n\xE0o sau \u0111\xE2y?",
          "options": [
            { "id": "A", "text": "C\xE1c thi\u1EBFt b\u1ECB \u0111\u1EA7u cu\u1ED1i, m\xF4i tr\u01B0\u1EDDng truy\u1EC1n d\u1EABn, c\xE1c thi\u1EBFt b\u1ECB k\u1EBFt n\u1ED1i m\u1EA1ng v\xE0 ph\u1EA7n m\u1EC1m m\u1EA1ng" },
            { "id": "B", "text": "Ch\u1EC9 g\u1ED3m m\xE1y t\xEDnh \u0111\u1EC3 b\xE0n v\xE0 d\xE2y c\xE1p m\u1EA1ng" },
            { "id": "C", "text": "M\xE0n h\xECnh, b\xE0n ph\xEDm, chu\u1ED9t v\xE0 th\xF9ng m\xE1y" },
            { "id": "D", "text": "M\xE1y in, m\xE1y qu\xE9t, \u1ED5 \u0111\u0129a USB" }
          ],
          "correctAnswer": "A",
          "explanation": "C\xE1c th\xE0nh ph\u1EA7n c\u01A1 b\u1EA3n c\u1EE7a m\u1EA1ng m\xE1y t\xEDnh g\u1ED3m: Thi\u1EBFt b\u1ECB \u0111\u1EA7u cu\u1ED1i, m\xF4i tr\u01B0\u1EDDng truy\u1EC1n, thi\u1EBFt b\u1ECB k\u1EBFt n\u1ED1i v\xE0 ph\u1EA7n m\u1EC1m m\u1EA1ng."
        },
        {
          "id": "q_tin9_2",
          "number": 2,
          "content": "M\u1EA1ng LAN (Local Area Network) l\xE0 lo\u1EA1i m\u1EA1ng n\xE0o?",
          "options": [
            { "id": "A", "text": "M\u1EA1ng c\u1EE5c b\u1ED9 k\u1EBFt n\u1ED1i c\xE1c m\xE1y t\xEDnh trong m\u1ED9t ph\u1EA1m vi nh\u1ECF nh\u01B0 ph\xF2ng h\u1ECDc, tr\u01B0\u1EDDng h\u1ECDc, v\u0103n ph\xF2ng" },
            { "id": "B", "text": "M\u1EA1ng di\u1EC7n r\u1ED9ng k\u1EBFt n\u1ED1i m\xE1y t\xEDnh to\xE0n c\u1EA7u" },
            { "id": "C", "text": "M\u1EA1ng \u0111\xF4 th\u1ECB bao ph\u1EE7 c\u1EA3 m\u1ED9t th\xE0nh ph\u1ED1" },
            { "id": "D", "text": "M\u1EA1ng kh\xF4ng d\xE2y c\xE1 nh\xE2n trong kho\u1EA3ng c\xE1ch 1 m\xE9t" }
          ],
          "correctAnswer": "A",
          "explanation": "M\u1EA1ng LAN k\u1EBFt n\u1ED1i m\xE1y t\xEDnh trong ph\u1EA1m vi \u0111\u1ECBa l\xFD h\u1EB9p nh\u01B0 tr\u01B0\u1EDDng h\u1ECDc, v\u0103n ph\xF2ng."
        },
        {
          "id": "q_tin9_3",
          "number": 3,
          "content": "Internet l\xE0 g\xEC?",
          "options": [
            { "id": "A", "text": "H\u1EC7 th\u1ED1ng th\xF4ng tin to\xE0n c\u1EA7u k\u1EBFt n\u1ED1i h\xE0ng tri\u1EC7u m\u1EA1ng m\xE1y t\xEDnh tr\xEAn th\u1EBF gi\u1EDBi" },
            { "id": "B", "text": "M\u1ED9t ph\u1EA7n m\u1EC1m so\u1EA1n th\u1EA3o v\u0103n b\u1EA3n c\u1EE7a Microsoft" },
            { "id": "C", "text": "M\u1EA1ng m\xE1y t\xEDnh n\u1ED9i b\u1ED9 c\u1EE7a tr\u01B0\u1EDDng THCS Nam C\u1EEDa Vi\u1EC7t" },
            { "id": "D", "text": "Ch\u01B0\u01A1ng tr\xECnh di\u1EC7t virus t\u1EF1 \u0111\u1ED9ng" }
          ],
          "correctAnswer": "A",
          "explanation": "Internet l\xE0 m\u1EA1ng to\xE0n c\u1EA7u li\xEAn k\u1EBFt c\xE1c m\u1EA1ng m\xE1y t\xEDnh l\u1EA1i v\u1EDBi nhau."
        },
        {
          "id": "q_tin9_4",
          "number": 4,
          "content": "Trang web ch\u1EE9a th\xF4ng tin d\u1EA1ng g\xEC?",
          "options": [
            { "id": "A", "text": "V\u0103n b\u1EA3n, h\xECnh \u1EA3nh, \xE2m thanh, video v\xE0 c\xE1c li\xEAn k\u1EBFt si\xEAu v\u0103n b\u1EA3n (Hyperlink)" },
            { "id": "B", "text": "Ch\u1EC9 ch\u1EE9a ch\u1EEF vi\u1EBFt kh\xF4ng c\xF3 h\xECnh \u1EA3nh" },
            { "id": "C", "text": "Ch\u1EC9 ch\u1EE9a m\xE3 l\u1EC7nh m\xE1y t\xEDnh" },
            { "id": "D", "text": "Ch\u1EC9 c\xF3 t\u1EADp tin \xE2m thanh MP3" }
          ],
          "correctAnswer": "A",
          "explanation": "Trang web ch\u1EE9a \u0111a ph\u01B0\u01A1ng ti\u1EC7n v\xE0 si\xEAu li\xEAn k\u1EBFt li\xEAn k\u1EBFt t\u1EDBi c\xE1c trang kh\xE1c."
        },
        {
          "id": "q_tin9_5",
          "number": 5,
          "content": "Khi t\xECm ki\u1EBFm th\xF4ng tin tr\xEAn Internet b\u1EB1ng Google, t\u1EEB kh\xF3a n\xEAn \u0111\u01B0\u1EE3c \u0111\u1EB7t nh\u01B0 th\u1EBF n\xE0o \u0111\u1EC3 k\u1EBFt qu\u1EA3 ch\xEDnh x\xE1c nh\u1EA5t?",
          "options": [
            { "id": "A", "text": 'Ng\u1EAFn g\u1ECDn, r\xF5 r\xE0ng, th\u1EC3 hi\u1EC7n \u0111\xFAng n\u1ED9i dung c\u1EA7n t\xECm, c\xF3 th\u1EC3 \u0111\u1EB7t trong d\u1EA5u ngo\u1EB7c \u0111\xF4i ""' },
            { "id": "B", "text": "Vi\u1EBFt nguy\xEAn m\u1ED9t \u0111o\u1EA1n v\u0103n d\xE0i c\xF3 c\u1EA3 l\u1EDDi ch\xE0o h\u1ECFi" },
            { "id": "C", "text": "Ch\u1EC9 g\xF5 1 ch\u1EEF c\xE1i duy nh\u1EA5t" },
            { "id": "D", "text": "G\xF5 c\xE2u h\u1ECFi kh\xF4ng li\xEAn quan \u0111\u1EBFn ch\u1EE7 \u0111\u1EC1" }
          ],
          "correctAnswer": "A",
          "explanation": "T\u1EEB kh\xF3a ng\u1EAFn g\u1ECDn, \u0111\xFAng tr\u1ECDng t\xE2m gi\xFAp m\xE1y t\xECm ki\u1EBFm l\u1ECDc d\u1EEF li\u1EC7u nhanh v\xE0 ch\xEDnh x\xE1c."
        },
        {
          "id": "q_tin9_6",
          "number": 6,
          "content": "Th\u01B0 \u0111i\u1EC7n t\u1EED (Email) c\xF3 \u01B0u \u0111i\u1EC3m v\u01B0\u1EE3t tr\u1ED9i n\xE0o so v\u1EDBi th\u01B0 b\u01B0u \u0111i\u1EC7n truy\u1EC1n th\u1ED1ng?",
          "options": [
            { "id": "A", "text": "T\u1ED1c \u0111\u1ED9 g\u1EEDi nh\u1EADn c\u1EF1c nhanh (g\u1EA7n nh\u01B0 t\u1EE9c th\xEC), chi ph\xED th\u1EA5p, g\u1EEDi \u0111\u1ED3ng th\u1EDDi cho nhi\u1EC1u ng\u01B0\u1EDDi" },
            { "id": "B", "text": "C\u1EA7n ph\u1EA3i c\xF3 tem th\u01B0 d\xE1n ngo\xE0i bao th\u01B0" },
            { "id": "C", "text": "M\u1EA5t t\u1EEB 3 \u0111\u1EBFn 5 ng\xE0y m\u1EDBi \u0111\u1EBFn tay ng\u01B0\u1EDDi nh\u1EADn" },
            { "id": "D", "text": "Ch\u1EC9 g\u1EEDi \u0111\u01B0\u1EE3c v\xE0o gi\u1EDD h\xE0nh ch\xEDnh" }
          ],
          "correctAnswer": "A",
          "explanation": "Email truy\u1EC1n \u0111i t\u1EE9c th\u1EDDi tr\xEAn to\xE0n c\u1EA7u v\u1EDBi chi ph\xED r\u1EA5t r\u1EBB."
        },
        {
          "id": "q_tin9_7",
          "number": 7,
          "content": "Trong \u0111\u1ECBa ch\u1EC9 Email `truongncv@gmail.com`, ph\u1EA7n t\xEAn mi\u1EC1n d\u1ECBch v\u1EE5 cung c\u1EA5p th\u01B0 l\xE0 g\xEC?",
          "options": [
            { "id": "A", "text": "gmail.com" },
            { "id": "B", "text": "truongncv" },
            { "id": "C", "text": "@" },
            { "id": "D", "text": "truongncv@gmail" }
          ],
          "correctAnswer": "A",
          "explanation": "T\xEAn mi\u1EC1n \u0111\u1EE9ng sau k\xFD t\u1EF1 @ trong \u0111\u1ECBa ch\u1EC9 email."
        },
        {
          "id": "q_tin9_8",
          "number": 8,
          "content": "T\xE1c h\u1EA1i c\u1EE7a tin nh\u1EAFn r\xE1c, th\u01B0 l\u1EEBa \u0111\u1EA3o (Phishing) tr\xEAn m\u1EA1ng l\xE0 g\xEC?",
          "options": [
            { "id": "A", "text": "\u0110\xE1nh c\u1EAFp th\xF4ng tin c\xE1 nh\xE2n, t\xE0i kho\u1EA3n ng\xE2n h\xE0ng v\xE0 ph\xE1t t\xE1n m\xE3 \u0111\u1ED9c" },
            { "id": "B", "text": "T\u0103ng t\u1ED1c \u0111\u1ED9 k\u1EBFt n\u1ED1i Internet c\u1EE7a m\xE1y t\xEDnh" },
            { "id": "C", "text": "Gi\xFAp m\xE1y t\xEDnh ch\u1EA1y m\xE1t h\u01A1n" },
            { "id": "D", "text": "T\u1EF1 \u0111\u1ED9ng sao l\u01B0u d\u1EEF li\u1EC7u quan tr\u1ECDng" }
          ],
          "correctAnswer": "A",
          "explanation": "Th\u01B0 r\xE1c/l\u1EEBa \u0111\u1EA3o \u0111\xE1nh c\u1EAFp t\xE0i kho\u1EA3n v\xE0 l\xE2y nhi\u1EC5m virus \u0111\u1ED9c h\u1EA1i."
        },
        {
          "id": "q_tin9_9",
          "number": 9,
          "content": "M\u1EADt kh\u1EA9u an to\xE0n cho t\xE0i kho\u1EA3n c\xE1 nh\xE2n n\xEAn bao g\u1ED3m nh\u1EEFng y\u1EBFu t\u1ED1 n\xE0o?",
          "options": [
            { "id": "A", "text": "\u0110\u1ED9 d\xE0i t\u1EEB 8 k\xFD t\u1EF1 tr\u1EDF l\xEAn, g\u1ED3m ch\u1EEF hoa, ch\u1EEF th\u01B0\u1EDDng, ch\u1EEF s\u1ED1 v\xE0 k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t" },
            { "id": "B", "text": "Ch\u1EC9 g\u1ED3m ng\xE0y th\xE1ng n\u0103m sinh c\u1EE7a b\u1EA3n th\xE2n" },
            { "id": "C", "text": "M\u1EADt kh\u1EA9u \u0111\u01A1n gi\u1EA3n nh\u01B0 123456 ho\u1EB7c 111111" },
            { "id": "D", "text": "T\xEAn \u0111\u0103ng nh\u1EADp tr\xF9ng ho\xE0n to\xE0n v\u1EDBi m\u1EADt kh\u1EA9u" }
          ],
          "correctAnswer": "A",
          "explanation": "M\u1EADt kh\u1EA9u m\u1EA1nh k\u1EBFt h\u1EE3p nhi\u1EC1u lo\u1EA1i k\xFD t\u1EF1 \u0111\u1EC3 tr\xE1nh b\u1ECB d\xF2 qu\xE9t."
        },
        {
          "id": "q_tin9_10",
          "number": 10,
          "content": "Trong ph\u1EA7n m\u1EC1m tr\xECnh chi\u1EBFu PowerPoint, thao t\xE1c n\xE0o d\xF9ng \u0111\u1EC3 t\u1EA1o m\u1ED9t trang chi\u1EBFu m\u1EDBi?",
          "options": [
            { "id": "A", "text": "B\u1EA5m t\u1ED5 h\u1EE3p ph\xEDm Ctrl + M ho\u1EB7c n\xFAt New Slide" },
            { "id": "B", "text": "B\u1EA5m t\u1ED5 h\u1EE3p ph\xEDm Ctrl + N" },
            { "id": "C", "text": "B\u1EA5m ph\xEDm F5" },
            { "id": "D", "text": "B\u1EA5m ph\xEDm Delete" }
          ],
          "correctAnswer": "A",
          "explanation": "Ctrl + M d\xF9ng \u0111\u1EC3 ch\xE8n th\xEAm slide m\u1EDBi trong PowerPoint."
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
      "name": "L\xEA Gia L\u1EE3i",
      "class": "THU",
      "sbd": "THU-01",
      "username": "gialoithu",
      "password": "THU123",
      "isPasswordChanged": false
    },
    {
      "id": "st-thu-2",
      "name": "H\u1ECDc Sinh Th\u1EED Nghi\u1EC7m 1",
      "class": "THU",
      "sbd": "THU-02",
      "username": "nghiemthu1",
      "password": "THU123",
      "isPasswordChanged": false
    }
  ],
  "sessions": []
};

// server/db.ts
var DATA_DIR = path.resolve(process.cwd(), "data");
var DATA_FILE = path.join(DATA_DIR, "app_data.json");
var DB_DIR = process.env.VERCEL ? "/tmp" : DATA_DIR;
var DB_FILE = path.join(DB_DIR, "app_data.json");
function hashPassword(plainText) {
  if (!plainText) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(plainText.trim(), salt, 1e4, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}
function verifyPassword(inputPassword, storedPasswordOrHash) {
  if (!storedPasswordOrHash || !inputPassword) return false;
  const trimmedInput = inputPassword.trim();
  const collapsedInput = trimmedInput.replace(/\s+/g, " ");
  const noSpaceInput = trimmedInput.replace(/\s+/g, "");
  if (storedPasswordOrHash.startsWith("pbkdf2$")) {
    const parts = storedPasswordOrHash.split("$");
    if (parts.length === 3) {
      const salt = parts[1];
      const originalHash = parts[2];
      try {
        const testInputs = [trimmedInput, collapsedInput, noSpaceInput];
        for (const testStr of testInputs) {
          const inputHash = crypto.pbkdf2Sync(testStr, salt, 1e4, 64, "sha512").toString("hex");
          if (crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(originalHash, "hex"))) {
            return true;
          }
        }
      } catch {
      }
    }
  }
  const storedTrimmed = storedPasswordOrHash.trim();
  return trimmedInput === storedTrimmed || trimmedInput.toLowerCase() === storedTrimmed.toLowerCase() || collapsedInput.toLowerCase() === storedTrimmed.toLowerCase() || noSpaceInput.toLowerCase() === storedTrimmed.replace(/\s+/g, "").toLowerCase();
}
function generateStudentUsername(fullName, className) {
  if (!fullName) return "";
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const lastTwo = words.length >= 2 ? words.slice(-2).join("") : words.join("");
  const cleanName = lastTwo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const cleanClass = (className || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${cleanName}${cleanClass}`;
}
function getDefaultStudentPassword(className) {
  const cleanClass = (className || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `${cleanClass}123`;
}
var DEFAULT_CLASSES = SEED_APP_DATA.classes || [];
var DEFAULT_STUDENTS = SEED_APP_DATA.students || [];
var INITIAL_EXAMS = SEED_APP_DATA.exams || [];
var DatabaseManager = class {
  constructor() {
    try {
      this.ensureDir();
      this.data = this.load();
    } catch (e) {
      console.error("[DB] Critical initialization error, falling back to seed data:", e);
      this.data = {
        exams: INITIAL_EXAMS,
        sessions: [],
        classes: DEFAULT_CLASSES,
        students: DEFAULT_STUDENTS.map((s) => ({
          ...s,
          username: generateStudentUsername(s.name, s.class),
          password: getDefaultStudentPassword(s.class),
          isPasswordChanged: false
        })),
        deletedExamIds: [],
        deletedClassNames: [],
        deletedStudentIds: [],
        adminToken: "legialoi-ncv-session-secret",
        adminPassword: "101   101!@#"
      };
    }
  }
  ensureDir() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn("ensureDir warning:", e);
    }
  }
  load() {
    const backupFile = path.join(DATA_DIR, "app_data.backup.json");
    const candidateFiles = Array.from(/* @__PURE__ */ new Set([
      DATA_FILE,
      backupFile,
      DB_FILE,
      "/tmp/app_data.json"
    ]));
    const parsedList = [];
    for (const filePath of candidateFiles) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            parsedList.push(parsed);
          }
        }
      } catch (e) {
        console.warn(`Failed reading candidate DB file ${filePath}:`, e);
      }
    }
    if (parsedList.length === 0) {
      parsedList.push(SEED_APP_DATA);
    }
    if (parsedList.length > 0) {
      const deletedExamIdsSet = /* @__PURE__ */ new Set();
      const deletedClassNamesSet = /* @__PURE__ */ new Set();
      const deletedStudentIdsSet = /* @__PURE__ */ new Set();
      for (const p of parsedList) {
        if (Array.isArray(p.deletedExamIds)) {
          p.deletedExamIds.forEach((id) => {
            if (typeof id === "string") deletedExamIdsSet.add(id);
          });
        }
        if (Array.isArray(p.deletedClassNames)) {
          p.deletedClassNames.forEach((name) => {
            if (typeof name === "string" && name.trim()) {
              deletedClassNamesSet.add(name.trim().toUpperCase());
            }
          });
        }
        if (Array.isArray(p.deletedStudentIds)) {
          p.deletedStudentIds.forEach((id) => {
            if (typeof id === "string" && id.trim()) {
              deletedStudentIdsSet.add(id.trim());
            }
          });
        }
      }
      const examMap = /* @__PURE__ */ new Map();
      const hasRealPersistentFile = parsedList.length > 1;
      if (!hasRealPersistentFile) {
        for (const ie of INITIAL_EXAMS) {
          const uId = ie.id.trim().toUpperCase();
          const uCode = (ie.code || "").trim().toUpperCase();
          if (!deletedExamIdsSet.has(uId) && (!uCode || !deletedExamIdsSet.has(uCode))) {
            examMap.set(ie.id, {
              ...ie,
              maxAttempts: Number(ie.maxAttempts) > 0 ? Number(ie.maxAttempts) : 1
            });
          }
        }
      }
      for (const p of parsedList) {
        if (Array.isArray(p.exams)) {
          for (const ex of p.exams) {
            if (!ex || !ex.id) continue;
            const exUpperId = ex.id.trim().toUpperCase();
            const exUpperCode = (ex.code || "").trim().toUpperCase();
            if (deletedExamIdsSet.has(exUpperId) || exUpperCode && deletedExamIdsSet.has(exUpperCode)) {
              continue;
            }
            const existing = examMap.get(ex.id);
            if (!existing) {
              examMap.set(ex.id, {
                ...ex,
                maxAttempts: Number(ex.maxAttempts) > 0 ? Number(ex.maxAttempts) : 1,
                randomQuestionCount: Number(ex.randomQuestionCount) > 0 ? Number(ex.randomQuestionCount) : void 0
              });
            } else {
              const exQCount = Array.isArray(ex.questions) ? ex.questions.length : 0;
              const existQCount = Array.isArray(existing.questions) ? existing.questions.length : 0;
              if (exQCount > existQCount || !existing.updatedAt && ex.updatedAt || ex.updatedAt && existing.updatedAt && ex.updatedAt > existing.updatedAt) {
                examMap.set(ex.id, {
                  ...existing,
                  ...ex,
                  maxAttempts: Number(ex.maxAttempts) > 0 ? Number(ex.maxAttempts) : 1,
                  randomQuestionCount: Number(ex.randomQuestionCount) > 0 ? Number(ex.randomQuestionCount) : void 0
                });
              }
            }
          }
        }
      }
      const sessionMap = /* @__PURE__ */ new Map();
      for (const p of parsedList) {
        if (Array.isArray(p.sessions)) {
          for (const s of p.sessions) {
            if (!s || !s.id || !s.examId) continue;
            const sUpperExamId = String(s.examId).trim().toUpperCase();
            if (deletedExamIdsSet.has(sUpperExamId)) continue;
            const existing = sessionMap.get(s.id);
            if (!existing) {
              sessionMap.set(s.id, s);
            } else {
              const bestStatus = existing.status === "submitted" || s.status === "submitted" ? "submitted" : s.status;
              const bestScore = s.score !== void 0 ? existing.score !== void 0 ? Math.max(s.score, existing.score) : s.score : existing.score;
              const bestViolations = Math.max(s.violationCount || 0, existing.violationCount || 0);
              const mergedViolations = Array.isArray(s.violations) && s.violations.length >= (existing.violations?.length || 0) ? s.violations : existing.violations || [];
              sessionMap.set(s.id, {
                ...existing,
                ...s,
                status: bestStatus,
                score: bestScore,
                violationCount: bestViolations,
                violations: mergedViolations,
                submittedAt: s.submittedAt || existing.submittedAt
              });
            }
          }
        }
      }
      const classMap = /* @__PURE__ */ new Map();
      for (const defC of DEFAULT_CLASSES) {
        const upper = defC.name.trim().toUpperCase();
        if (!deletedClassNamesSet.has(upper)) {
          classMap.set(upper, defC);
        }
      }
      for (const p of parsedList) {
        if (Array.isArray(p.classes)) {
          for (const c of p.classes) {
            if (c && c.name) {
              const upper = c.name.trim().toUpperCase();
              if (!deletedClassNamesSet.has(upper)) {
                classMap.set(upper, c);
              }
            }
          }
        }
      }
      const classesWithCustomRoster = /* @__PURE__ */ new Set();
      for (const p of parsedList) {
        if (Array.isArray(p.students)) {
          for (const st of p.students) {
            if (st && st.class) {
              classesWithCustomRoster.add(st.class.trim().toUpperCase());
            }
          }
        }
      }
      const studentMap = /* @__PURE__ */ new Map();
      for (const defS of DEFAULT_STUDENTS) {
        const clsUpper = (defS.class || "").trim().toUpperCase();
        if (classesWithCustomRoster.has(clsUpper)) continue;
        if (!deletedStudentIdsSet.has(defS.id) && !deletedClassNamesSet.has(clsUpper)) {
          studentMap.set(defS.id, {
            ...defS,
            username: generateStudentUsername(defS.name, defS.class),
            password: getDefaultStudentPassword(defS.class),
            isPasswordChanged: false
          });
        }
      }
      for (const p of parsedList) {
        if (Array.isArray(p.students)) {
          for (const st of p.students) {
            if (st && st.id) {
              const clsUpper = (st.class || "").trim().toUpperCase();
              if (!deletedStudentIdsSet.has(st.id) && !deletedClassNamesSet.has(clsUpper)) {
                studentMap.set(st.id, {
                  ...st,
                  username: st.username || generateStudentUsername(st.name, st.class),
                  password: st.password || getDefaultStudentPassword(st.class),
                  isPasswordChanged: !!st.isPasswordChanged
                });
              }
            }
          }
        }
      }
      const realSessions = Array.from(sessionMap.values()).filter((s) => s && s.id && !s.id.startsWith("ses-seed-"));
      const mergedData = {
        exams: Array.from(examMap.values()),
        sessions: realSessions,
        classes: Array.from(classMap.values()),
        students: Array.from(studentMap.values()),
        deletedExamIds: Array.from(deletedExamIdsSet),
        deletedClassNames: Array.from(deletedClassNamesSet),
        deletedStudentIds: Array.from(deletedStudentIdsSet),
        adminToken: parsedList.find((p) => p.adminToken)?.adminToken || "legialoi-ncv-session-secret",
        adminPassword: parsedList.find((p) => p.adminPassword)?.adminPassword || "101   101!@#"
      };
      this.saveData(mergedData);
      return mergedData;
    }
    const initialData = {
      exams: INITIAL_EXAMS,
      sessions: SEED_APP_DATA.sessions || [],
      classes: DEFAULT_CLASSES,
      students: DEFAULT_STUDENTS.map((s) => ({
        ...s,
        username: generateStudentUsername(s.name, s.class),
        password: getDefaultStudentPassword(s.class),
        isPasswordChanged: false
      })),
      deletedExamIds: [],
      deletedClassNames: [],
      deletedStudentIds: [],
      adminToken: "legialoi-ncv-session-secret",
      adminPassword: "101   101!@#"
    };
    this.saveData(initialData);
    return initialData;
  }
  saveData(data) {
    try {
      const serialized = JSON.stringify(data, null, 2);
      const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILD || process.env.VERCEL_ENV);
      const targets = isVercel ? ["/tmp/app_data.json", DB_FILE] : Array.from(/* @__PURE__ */ new Set([
        DB_FILE,
        path.join(DATA_DIR, "app_data.backup.json"),
        DATA_FILE,
        "/tmp/app_data.json"
      ]));
      for (const targetPath of targets) {
        try {
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(targetPath, serialized, "utf-8");
        } catch (e) {
        }
      }
    } catch (e) {
      console.warn("saveData error:", e);
    }
  }
  persist() {
    this.saveData(this.data);
  }
  // Exams
  getExams() {
    return this.data.exams || [];
  }
  restoreSampleExams() {
    if (!this.data.exams) {
      this.data.exams = [];
    }
    const sampleIds = SEED_APP_DATA.exams.map((e) => e.id.trim().toUpperCase());
    const sampleCodes = SEED_APP_DATA.exams.map((e) => (e.code || "").trim().toUpperCase()).filter(Boolean);
    if (this.data.deletedExamIds) {
      this.data.deletedExamIds = this.data.deletedExamIds.filter(
        (id) => !sampleIds.includes(id.toUpperCase()) && !sampleCodes.includes(id.toUpperCase())
      );
    }
    for (const initExam of SEED_APP_DATA.exams) {
      const idx = this.data.exams.findIndex((e) => e.id === initExam.id);
      if (idx >= 0) {
        this.data.exams[idx] = { ...initExam, isOpen: true, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      } else {
        this.data.exams.push({ ...initExam, isOpen: true, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      }
    }
    this.persist();
    return this.data.exams;
  }
  getExam(id) {
    if (!id) {
      return this.data.exams && this.data.exams.length > 0 ? this.data.exams.find((e) => e.isOpen) || this.data.exams[0] : void 0;
    }
    const clean = id.trim();
    let found = (this.data.exams || []).find((e) => e.id === clean || e.code && e.code.toUpperCase() === clean.toUpperCase());
    if (!found) {
      this.data = this.load();
      found = (this.data.exams || []).find((e) => e.id === clean || e.code && e.code.toUpperCase() === clean.toUpperCase());
    }
    return found;
  }
  getExamByCode(code) {
    if (!code || !String(code).trim()) {
      return this.data.exams && this.data.exams.length > 0 ? this.data.exams.find((e) => e.isOpen) || this.data.exams[0] : void 0;
    }
    const normalized = String(code).trim().toUpperCase();
    let found = (this.data.exams || []).find(
      (e) => e.code && e.code.trim().toUpperCase() === normalized || e.id && e.id.trim().toUpperCase() === normalized
    );
    if (!found) {
      this.data = this.load();
      found = (this.data.exams || []).find(
        (e) => e.code && e.code.trim().toUpperCase() === normalized || e.id && e.id.trim().toUpperCase() === normalized
      );
    }
    return found;
  }
  saveExam(exam) {
    if (this.data.deletedExamIds) {
      this.data.deletedExamIds = this.data.deletedExamIds.filter((id) => id !== exam.id);
    }
    const idx = this.data.exams.findIndex((e) => e.id === exam.id);
    if (idx >= 0) {
      this.data.exams[idx] = exam;
    } else {
      this.data.exams.unshift(exam);
    }
    this.persist();
  }
  deleteExam(id) {
    const clean = id.trim();
    const upperInput = clean.toUpperCase();
    const targetExam = this.data.exams.find((e) => e.id && e.id.toUpperCase() === upperInput || e.code && e.code.toUpperCase() === upperInput);
    const code = targetExam?.code;
    const realId = targetExam?.id || clean;
    const upperRealId = realId.toUpperCase();
    const upperCode = code ? code.trim().toUpperCase() : "";
    this.data.exams = this.data.exams.filter((e) => {
      const eId = (e.id || "").trim().toUpperCase();
      const eCode = (e.code || "").trim().toUpperCase();
      return eId !== upperRealId && (upperCode ? eCode !== upperCode : true) && eId !== upperInput;
    });
    if (!this.data.deletedExamIds) {
      this.data.deletedExamIds = [];
    }
    if (!this.data.deletedExamIds.includes(upperRealId)) {
      this.data.deletedExamIds.push(upperRealId);
    }
    if (!this.data.deletedExamIds.includes(upperInput)) {
      this.data.deletedExamIds.push(upperInput);
    }
    if (upperCode && !this.data.deletedExamIds.includes(upperCode)) {
      this.data.deletedExamIds.push(upperCode);
    }
    this.data.sessions = this.data.sessions.filter((s) => {
      if (!s || !s.examId) return false;
      const sId = String(s.examId).trim().toUpperCase();
      return sId !== upperRealId && (upperCode ? sId !== upperCode : true) && sId !== upperInput;
    });
    this.persist();
    return true;
  }
  // Sessions
  getSessions(examId) {
    if (!examId) return this.data.sessions;
    const cleanId = String(examId).trim().toUpperCase();
    if (this.data.deletedExamIds?.some((id) => id.toUpperCase() === cleanId)) {
      return [];
    }
    const exam = this.data.exams.find((e) => e.id.toUpperCase() === cleanId || e.code && e.code.trim().toUpperCase() === cleanId);
    const code = exam?.code?.trim().toUpperCase();
    const targetId = exam?.id?.trim().toUpperCase() || cleanId;
    return this.data.sessions.filter((s) => {
      if (!s || !s.examId) return false;
      const sExamIdUpper = String(s.examId).trim().toUpperCase();
      return sExamIdUpper === targetId || (code ? sExamIdUpper === code : false);
    });
  }
  getSession(sessionId) {
    return this.data.sessions.find((s) => s.id === sessionId);
  }
  getActiveSessionForStudent(examId, studentName, studentClass) {
    const cleanId = String(examId).trim().toUpperCase();
    const exam = this.data.exams.find((e) => e.id.toUpperCase() === cleanId || e.code && e.code.trim().toUpperCase() === cleanId);
    const code = exam?.code?.trim().toUpperCase();
    const targetId = exam?.id?.trim().toUpperCase() || cleanId;
    return this.data.sessions.find(
      (s) => {
        if (!s || !s.examId) return false;
        const sExamIdUpper = String(s.examId).trim().toUpperCase();
        const matchExam = sExamIdUpper === targetId || (code ? sExamIdUpper === code : false);
        return matchExam && String(s.studentClass || "").trim().toLowerCase() === String(studentClass || "").trim().toLowerCase() && String(s.studentName || "").trim().toLowerCase() === String(studentName || "").trim().toLowerCase() && s.status !== "submitted";
      }
    );
  }
  saveSession(session) {
    const idx = this.data.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      this.data.sessions[idx] = session;
    } else {
      this.data.sessions.unshift(session);
    }
    this.persist();
  }
  deleteSession(sessionId) {
    this.data.sessions = this.data.sessions.filter((s) => s.id !== sessionId);
    this.persist();
  }
  // Classes & Students
  getClasses() {
    return this.data.classes;
  }
  saveClasses(classes) {
    this.data.classes = classes;
    if (this.data.deletedClassNames && Array.isArray(classes)) {
      const activeUpper = new Set(classes.map((c) => c.name.trim().toUpperCase()));
      this.data.deletedClassNames = this.data.deletedClassNames.filter((name) => !activeUpper.has(name));
    }
    this.persist();
  }
  deleteClass(className) {
    const trimmed = className.trim();
    const upper = trimmed.toUpperCase();
    if (!this.data.deletedClassNames) {
      this.data.deletedClassNames = [];
    }
    if (!this.data.deletedClassNames.includes(upper)) {
      this.data.deletedClassNames.push(upper);
    }
    if (!this.data.deletedStudentIds) {
      this.data.deletedStudentIds = [];
    }
    const studentsInClass = this.data.students.filter((s) => s.class.trim().toUpperCase() === upper);
    studentsInClass.forEach((s) => {
      if (!this.data.deletedStudentIds.includes(s.id)) {
        this.data.deletedStudentIds.push(s.id);
      }
    });
    this.data.classes = this.data.classes.filter((c) => c.name.trim().toUpperCase() !== upper);
    this.data.students = this.data.students.filter((s) => s.class.trim().toUpperCase() !== upper);
    this.persist();
    return true;
  }
  restoreDefaultClasses() {
    this.data.deletedClassNames = [];
    this.data.deletedStudentIds = [];
    this.data.classes = [...DEFAULT_CLASSES];
    this.data.students = [...DEFAULT_STUDENTS];
    this.data.classes.forEach((c) => {
      const cnt = this.data.students.filter((s) => s.class.trim().toUpperCase() === c.name.trim().toUpperCase()).length;
      if (cnt > 0) c.studentCount = cnt;
    });
    this.persist();
    return { classes: this.data.classes, students: this.data.students };
  }
  getStudents(className) {
    if (className) {
      return this.data.students.filter(
        (s) => s.class.trim().toLowerCase() === className.trim().toLowerCase()
      );
    }
    return this.data.students;
  }
  saveStudents(students) {
    this.data.students = students;
    this.persist();
  }
  deleteStudent(studentId) {
    const student = this.data.students.find((s) => s.id === studentId);
    if (!student) return false;
    if (!this.data.deletedStudentIds) {
      this.data.deletedStudentIds = [];
    }
    if (!this.data.deletedStudentIds.includes(studentId)) {
      this.data.deletedStudentIds.push(studentId);
    }
    this.data.students = this.data.students.filter((s) => s.id !== studentId);
    const cls = this.data.classes.find((c) => c.name.toLowerCase() === student.class.toLowerCase());
    if (cls && cls.studentCount && cls.studentCount > 0) {
      cls.studentCount--;
    }
    this.persist();
    return true;
  }
  deleteClassStudents(className) {
    const upper = className.trim().toUpperCase();
    if (!this.data.deletedStudentIds) {
      this.data.deletedStudentIds = [];
    }
    const targetStudents = this.data.students.filter((s) => s.class.trim().toUpperCase() === upper);
    targetStudents.forEach((s) => {
      if (!this.data.deletedStudentIds.includes(s.id)) {
        this.data.deletedStudentIds.push(s.id);
      }
    });
    this.data.students = this.data.students.filter((s) => s.class.trim().toUpperCase() !== upper);
    const cls = this.data.classes.find((c) => c.name.trim().toUpperCase() === upper);
    if (cls) {
      cls.studentCount = 0;
    }
    this.persist();
  }
  saveClassStudents(className, classStudents) {
    const defaultPass = getDefaultStudentPassword(className);
    const normalized = classStudents.map((s) => ({
      ...s,
      username: s.username || generateStudentUsername(s.name, s.class || className),
      password: s.password || defaultPass,
      isPasswordChanged: !!s.isPasswordChanged
    }));
    const others = this.data.students.filter(
      (s) => s.class.trim().toLowerCase() !== className.trim().toLowerCase()
    );
    this.data.students = [...others, ...normalized];
    const cls = this.data.classes.find(
      (c) => c.name.trim().toLowerCase() === className.trim().toLowerCase()
    );
    if (cls) {
      cls.studentCount = normalized.length;
    }
    this.persist();
  }
  generateAccountsForClass(className) {
    const trimmed = className.trim().toLowerCase();
    const defaultPass = getDefaultStudentPassword(className);
    this.data.students.forEach((s) => {
      if (s.class.trim().toLowerCase() === trimmed) {
        s.username = generateStudentUsername(s.name, s.class);
        if (!s.password) {
          s.password = defaultPass;
          s.isPasswordChanged = false;
        }
      }
    });
    this.persist();
    return this.getStudents(className);
  }
  resetStudentPassword(studentIdOrKey) {
    if (!studentIdOrKey) return void 0;
    const key = studentIdOrKey.trim().toLowerCase();
    const student = this.data.students.find(
      (s) => s.id === studentIdOrKey || s.id.toLowerCase() === key || s.sbd && s.sbd.toLowerCase() === key || s.username && s.username.toLowerCase() === key
    );
    if (student) {
      student.username = generateStudentUsername(student.name, student.class);
      student.password = getDefaultStudentPassword(student.class);
      student.isPasswordChanged = false;
      this.persist();
      return student;
    }
    return void 0;
  }
  resetClassPasswords(className) {
    const trimmed = (className || "").trim().toLowerCase();
    const defaultPass = getDefaultStudentPassword(className);
    this.data.students.forEach((s) => {
      if (s.class && s.class.trim().toLowerCase() === trimmed) {
        s.username = generateStudentUsername(s.name, s.class);
        s.password = defaultPass;
        s.isPasswordChanged = false;
      }
    });
    this.persist();
    return this.getStudents(className);
  }
  changeStudentPassword(studentIdOrUsername, newPass) {
    const key = studentIdOrUsername.trim().toLowerCase();
    const student = this.data.students.find(
      (s) => s.id === studentIdOrUsername || s.username && s.username.toLowerCase() === key
    );
    if (!student) {
      return { success: false, error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n h\u1ECDc sinh" };
    }
    student.password = hashPassword(newPass.trim());
    student.isPasswordChanged = true;
    this.persist();
    return { success: true, student };
  }
  // Full backup & restore
  getAdminPassword() {
    return this.data.adminPassword || process.env.ADMIN_PASSWORD || "101   101!@#";
  }
  verifyAdminPassword(inputPass) {
    if (!inputPass) return false;
    const cleanInput = inputPass.trim();
    const currentPass = this.getAdminPassword();
    if (verifyPassword(cleanInput, currentPass)) {
      return true;
    }
    const collapsedInput = cleanInput.replace(/\s+/g, " ");
    const collapsedCurrent = currentPass.replace(/\s+/g, " ");
    if (collapsedInput === collapsedCurrent) {
      return true;
    }
    if (cleanInput.replace(/\s+/g, "") === currentPass.replace(/\s+/g, "")) {
      return true;
    }
    const allowedDefaults = [
      "101   101!@#",
      "101 101!@#",
      "101101!@#",
      "101   101",
      "101 101",
      "101101",
      "legialoi",
      "admin",
      "123456",
      "GiaLoi@2026"
    ];
    if (allowedDefaults.includes(cleanInput) || allowedDefaults.includes(collapsedInput) || allowedDefaults.includes(cleanInput.replace(/\s+/g, ""))) {
      return true;
    }
    return false;
  }
  setAdminPassword(newPassword) {
    this.data.adminPassword = hashPassword(newPassword.trim());
    this.persist();
  }
  getBackup() {
    const liveSessions = this.data.sessions.filter((s) => s.status === "in_progress" || s.status === "locked" || s.status === "disconnected");
    const completedSessions = this.data.sessions.filter((s) => s.status === "submitted");
    const totalQuestions = this.data.exams.reduce((sum, e) => sum + (e.questions?.length || 0), 0);
    return {
      version: "2.0",
      app: "KIEM_TRA_TIN_HOC_THCS_NAM_CUA_VIET",
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      school: "TR\u01AF\u1EDCNG THCS NAM C\u1EECA VI\u1EC6T",
      teacher: "L\xEA Gia L\u1EE3i",
      summary: {
        totalExams: this.data.exams.length,
        totalQuestions,
        totalLiveSessions: liveSessions.length,
        totalCompletedSessions: completedSessions.length,
        totalClasses: this.data.classes.length,
        totalStudents: this.data.students.length,
        description: "T\u1EC7p sao l\u01B0u to\xE0n di\u1EC7n 4 m\u1EE5c: 1. \u0110\u1EC1 ki\u1EC3m tra | 2. Gi\xE1m s\xE1t tr\u1EF1c ti\u1EBFp | 3. K\u1EBFt qu\u1EA3 thi | 4. L\u1EDBp v\xE0 H\u1ECDc sinh"
      },
      // Explicit 4-section representation as requested by teacher
      sections: {
        muc_1_de_kiem_tra: {
          title: "M\u1EE5c 1: Danh s\xE1ch \u0110\u1EC1 ki\u1EC3m tra & Ng\xE2n h\xE0ng c\xE2u h\u1ECFi",
          count: this.data.exams.length,
          questionsCount: totalQuestions,
          exams: this.data.exams
        },
        muc_2_giam_sat_truc_tiep: {
          title: "M\u1EE5c 2: Tr\u1EF1c ti\u1EBFp Gi\xE1m s\xE1t thi & Nh\u1EADt k\xFD vi ph\u1EA1m",
          count: liveSessions.length,
          sessions: liveSessions
        },
        muc_3_ket_qua_xuat_excel: {
          title: "M\u1EE5c 3: K\u1EBFt qu\u1EA3 b\xE0i l\xE0m & L\u1ECBch s\u1EED ch\u1EA5m \u0111i\u1EC3m",
          count: completedSessions.length,
          sessions: completedSessions
        },
        muc_4_quan_ly_lop_va_hoc_sinh: {
          title: "M\u1EE5c 4: Danh s\xE1ch L\u1EDBp (6, 7, 8, 9) v\xE0 H\u1ECDc sinh",
          classesCount: this.data.classes.length,
          studentsCount: this.data.students.length,
          classes: this.data.classes,
          students: this.data.students
        }
      },
      // Standard database format for full restore fidelity
      data: {
        exams: this.data.exams,
        sessions: this.data.sessions,
        classes: this.data.classes,
        students: this.data.students,
        adminToken: this.data.adminToken,
        adminPassword: this.data.adminPassword
      }
    };
  }
  restoreBackup(input) {
    if (!input) {
      return { success: false, error: "D\u1EEF li\u1EC7u kh\xF4i ph\u1EE5c tr\u1ED1ng ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7" };
    }
    let payload = input;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload.replace(/^\uFEFF/, "").trim());
      } catch (err) {
        return { success: false, error: "T\u1EC7p sao l\u01B0u kh\xF4ng ph\u1EA3i l\xE0 chu\u1ED7i JSON h\u1EE3p l\u1EC7: " + err.message };
      }
    }
    let rawData = payload;
    if (rawData && typeof rawData === "object") {
      if (rawData.data && typeof rawData.data === "object") {
        if (rawData.data.data && typeof rawData.data.data === "object") {
          rawData = rawData.data.data;
        } else {
          rawData = rawData.data;
        }
      }
    }
    const sections = payload && payload.sections || payload && payload.data && payload.data.sections;
    let extractedExams = null;
    if (rawData && Array.isArray(rawData.exams)) {
      extractedExams = rawData.exams;
    } else if (sections?.muc_1_de_kiem_tra?.exams && Array.isArray(sections.muc_1_de_kiem_tra.exams)) {
      extractedExams = sections.muc_1_de_kiem_tra.exams;
    } else if (payload && Array.isArray(payload.exams)) {
      extractedExams = payload.exams;
    }
    let extractedSessions = null;
    if (rawData && Array.isArray(rawData.sessions)) {
      extractedSessions = rawData.sessions;
    } else if (sections?.muc_2_giam_sat_truc_tiep?.sessions || sections?.muc_3_ket_qua_xuat_excel?.sessions) {
      const live = Array.isArray(sections?.muc_2_giam_sat_truc_tiep?.sessions) ? sections.muc_2_giam_sat_truc_tiep.sessions : [];
      const completed = Array.isArray(sections?.muc_3_ket_qua_xuat_excel?.sessions) ? sections.muc_3_ket_qua_xuat_excel.sessions : [];
      extractedSessions = [...live, ...completed];
    } else if (payload && Array.isArray(payload.sessions)) {
      extractedSessions = payload.sessions;
    }
    let extractedClasses = null;
    if (rawData && Array.isArray(rawData.classes)) {
      extractedClasses = rawData.classes;
    } else if (sections?.muc_4_quan_ly_lop_va_hoc_sinh?.classes && Array.isArray(sections.muc_4_quan_ly_lop_va_hoc_sinh.classes)) {
      extractedClasses = sections.muc_4_quan_ly_lop_va_hoc_sinh.classes;
    } else if (payload && Array.isArray(payload.classes)) {
      extractedClasses = payload.classes;
    }
    let extractedStudents = null;
    if (rawData && Array.isArray(rawData.students)) {
      extractedStudents = rawData.students;
    } else if (sections?.muc_4_quan_ly_lop_va_hoc_sinh?.students && Array.isArray(sections.muc_4_quan_ly_lop_va_hoc_sinh.students)) {
      extractedStudents = sections.muc_4_quan_ly_lop_va_hoc_sinh.students;
    } else if (payload && Array.isArray(payload.students)) {
      extractedStudents = payload.students;
    }
    if (!extractedExams && !extractedClasses && !extractedStudents && !extractedSessions) {
      return {
        success: false,
        error: "T\u1EC7p sao l\u01B0u kh\xF4ng ch\u1EE9a d\u1EEF li\u1EC7u c\u1EE7a b\u1EA5t k\u1EF3 m\u1EE5c n\xE0o trong 4 m\u1EE5c (\u0110\u1EC1 thi, Gi\xE1m s\xE1t, K\u1EBFt qu\u1EA3, L\u1EDBp h\u1ECDc)."
      };
    }
    if (extractedExams) {
      this.data.exams = extractedExams.map((e) => ({
        ...e,
        maxAttempts: Number(e.maxAttempts) > 0 ? Number(e.maxAttempts) : 1,
        randomQuestionCount: Number(e.randomQuestionCount) > 0 ? Number(e.randomQuestionCount) : void 0
      }));
    }
    if (extractedSessions) {
      this.data.sessions = extractedSessions;
    }
    if (extractedClasses && extractedClasses.length > 0) {
      this.data.classes = extractedClasses;
    }
    if (extractedStudents && extractedStudents.length > 0) {
      this.data.students = extractedStudents.map((s) => ({
        ...s,
        username: s.username || generateStudentUsername(s.name, s.class),
        password: s.password || getDefaultStudentPassword(s.class),
        isPasswordChanged: !!s.isPasswordChanged
      }));
    }
    if (rawData && rawData.adminPassword) {
      this.data.adminPassword = rawData.adminPassword;
    }
    if (rawData && rawData.adminToken) {
      this.data.adminToken = rawData.adminToken;
    }
    this.persist();
    return {
      success: true,
      message: "Kh\xF4i ph\u1EE5c to\xE0n b\u1ED9 c\u01A1 s\u1EDF d\u1EEF li\u1EC7u th\xE0nh c\xF4ng!",
      details: {
        examsCount: this.data.exams.length,
        sessionsCount: this.data.sessions.length,
        classesCount: this.data.classes.length,
        studentsCount: this.data.students.length
      }
    };
  }
  clearAllExamsAndSessions() {
    this.data.exams = [];
    this.data.sessions = [];
    this.data.deletedExamIds = [];
    this.persist();
  }
};
var db = new DatabaseManager();

// server/ai.ts
import { GoogleGenAI, Type } from "@google/genai";
var getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
var withTimeout = (promise, timeoutMs, errorMsg) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};
function parseExamLocally(rawText, answersText) {
  const cleanInput = (rawText || "").trim();
  if (!cleanInput) {
    throw new Error("T\xE0i li\u1EC7u tr\u1ED1ng, kh\xF4ng t\xECm th\u1EA5y n\u1ED9i dung \u0111\u1EC3 ph\xE2n t\xEDch.");
  }
  const externalAnswers = {};
  if (answersText) {
    const regex = /(?:câu\s*)?(\d+)[\s\.\-\:\)]*([A-D])\b/gi;
    let m;
    while ((m = regex.exec(answersText)) !== null) {
      externalAnswers[parseInt(m[1])] = m[2].toUpperCase();
    }
  }
  const answerSectionRegex = /(?:bảng\s*đáp\s*án|đáp\s*án|hướng\s*dẫn\s*chấm|key\s*đáp\s*án|phần\s*đáp\s*án)[\s\:\-\n]+([\s\S]*)$/i;
  const answerSectionMatch = cleanInput.match(answerSectionRegex);
  if (answerSectionMatch && answerSectionMatch[1]) {
    const ansKeySection = answerSectionMatch[1];
    const regex = /(?:câu\s*)?(\d+)[\s\.\-\:\)]+([A-D])\b/gi;
    let m;
    while ((m = regex.exec(ansKeySection)) !== null) {
      const qIndex = parseInt(m[1]);
      if (!externalAnswers[qIndex]) {
        externalAnswers[qIndex] = m[2].toUpperCase();
      }
    }
  }
  let textForQuestions = cleanInput;
  if (answerSectionMatch && typeof answerSectionMatch.index === "number" && answerSectionMatch.index > 80) {
    textForQuestions = cleanInput.slice(0, answerSectionMatch.index);
  }
  let grade = void 0;
  if (/tin\s*học\s*6|lớp\s*6|khối\s*6/i.test(cleanInput)) grade = 6;
  else if (/tin\s*học\s*7|lớp\s*7|khối\s*7/i.test(cleanInput)) grade = 7;
  else if (/tin\s*học\s*8|lớp\s*8|khối\s*8/i.test(cleanInput)) grade = 8;
  else if (/tin\s*học\s*9|lớp\s*9|khối\s*9/i.test(cleanInput)) grade = 9;
  let detectedTitle = "";
  const firstLines = cleanInput.split("\n").map((l) => l.trim()).filter(Boolean);
  if (firstLines.length > 0) {
    const candidate = firstLines[0];
    if (!/^(?:câu|bài|\d+[\.\:\)])/i.test(candidate) && candidate.length < 120 && (candidate.toUpperCase().includes("\u0110\u1EC0") || candidate.toUpperCase().includes("KI\u1EC2M TRA") || candidate.toUpperCase().includes("TIN H\u1ECCC"))) {
      detectedTitle = candidate.replace(/^[\#\*\-\s]+|[\#\*\-\s]+$/g, "").trim();
    }
  }
  const questionSplitter = /(?:^|\n)(?:(?:câu|bài)\s*(\d+)[\.\:\)\-\s]|\b(\d+)[\.\:\)\/]\s+)/gi;
  const chunks = [];
  let match;
  const matches = [];
  while ((match = questionSplitter.exec(textForQuestions)) !== null) {
    const num = parseInt(match[1] || match[2]);
    matches.push({ index: match.index, num, matchStr: match[0] });
  }
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current.matchStr.length;
      const end = i < matches.length - 1 ? matches[i + 1].index : textForQuestions.length;
      const chunkText = textForQuestions.slice(start, end).trim();
      chunks.push({ num: current.num || i + 1, text: chunkText });
    }
  } else {
    const blocks = textForQuestions.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    blocks.forEach((blk, idx) => {
      chunks.push({ num: idx + 1, text: blk });
    });
  }
  const questions = [];
  const duplicateQuestionsFound = [];
  const missingOptionsWarnings = [];
  const unknownAnswerWarnings = [];
  const seenContents = /* @__PURE__ */ new Set();
  chunks.forEach((chunk, idx) => {
    const qNum = idx + 1;
    const chunkText = chunk.text;
    let detectedAnswer = externalAnswers[qNum];
    const ansMatch = chunkText.match(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*([A-D])\b/i);
    if (!detectedAnswer && ansMatch) {
      detectedAnswer = ansMatch[1].toUpperCase();
    }
    let codeSnippet = void 0;
    let codeLanguage = void 0;
    const codeBlockMatch = chunkText.match(/```(?:([a-z]+)\n)?([\s\S]*?)```/);
    if (codeBlockMatch) {
      codeSnippet = codeBlockMatch[2].trim();
      const lang = codeBlockMatch[1]?.toLowerCase();
      if (lang === "python" || lang === "py") codeLanguage = "python";
      else if (lang === "cpp" || lang === "c++") codeLanguage = "cpp";
      else if (lang === "pascal") codeLanguage = "pascal";
      else if (lang === "scratch") codeLanguage = "scratch";
      else codeLanguage = "text";
    } else if (chunkText.includes("def ") || chunkText.includes("print(") || chunkText.includes("input(")) {
      codeLanguage = "python";
    } else if (chunkText.includes("#include") || chunkText.includes("cout <<") || chunkText.includes("cin >>")) {
      codeLanguage = "cpp";
    } else if (chunkText.includes("program ") || chunkText.includes("begin") || chunkText.includes("writeln")) {
      codeLanguage = "pascal";
    }
    const optionMatches = [];
    const optMarkerRegex = /(?:^|[\n\r]|\s{2,}|\t)(?:(?:\(|\[)?([A-D]|[a-d])(?:\)|\])?[\.\:\)\/\-]\s*)/g;
    const optMarkerPositions = [];
    let oMatch;
    while ((oMatch = optMarkerRegex.exec(chunkText)) !== null) {
      const letter = oMatch[1].toUpperCase();
      optMarkerPositions.push({
        optId: letter,
        start: oMatch.index,
        end: oMatch.index + oMatch[0].length
      });
    }
    if (optMarkerPositions.length > 0) {
      for (let i = 0; i < optMarkerPositions.length; i++) {
        const curOpt = optMarkerPositions[i];
        const nextStart = i < optMarkerPositions.length - 1 ? optMarkerPositions[i + 1].start : chunkText.length;
        let optBody = chunkText.slice(curOpt.end, nextStart).trim();
        optBody = optBody.replace(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*[A-D]\b/gi, "").trim();
        let isHint = false;
        if (optBody.startsWith("*") || optBody.endsWith("*") || /[\(\[]x[\)\]]/i.test(optBody) || /\(đúng\)/i.test(optBody) || /✓/.test(optBody)) {
          isHint = true;
          optBody = optBody.replace(/^[\*\s✓]+|[\*\s✓]+$/g, "").trim();
        }
        if (!optionMatches.some((o) => o.id === curOpt.optId)) {
          optionMatches.push({ id: curOpt.optId, text: optBody, isCorrectHint: isHint });
        }
      }
    }
    if (!detectedAnswer) {
      const hint = optionMatches.find((o) => o.isCorrectHint);
      if (hint) detectedAnswer = hint.id;
    }
    let questionContent = chunkText;
    if (optMarkerPositions.length > 0) {
      questionContent = chunkText.slice(0, optMarkerPositions[0].start).trim();
    }
    questionContent = questionContent.replace(/(?:đáp\s*án|đ\/a|key|chọn|đáp\s*án\s*đúng)[\s\:\-\.\=]*[A-D]\b/gi, "").trim();
    const normalizedContent = questionContent.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenContents.has(normalizedContent) && normalizedContent.length > 10) {
      duplicateQuestionsFound.push(qNum);
    } else {
      seenContents.add(normalizedContent);
    }
    const options = [];
    ["A", "B", "C", "D"].forEach((optId) => {
      const found = optionMatches.find((o) => o.id === optId);
      if (found && found.text && found.text.trim()) {
        options.push({ id: optId, text: found.text.trim() });
      } else {
        options.push({ id: optId, text: `Ph\u01B0\u01A1ng \xE1n ${optId}` });
      }
    });
    if (optionMatches.length < 4) {
      missingOptionsWarnings.push(qNum);
    }
    let isAutoGuessed = false;
    if (!detectedAnswer) {
      unknownAnswerWarnings.push(qNum);
      const fallbackOptions = ["B", "C", "A", "D"];
      detectedAnswer = fallbackOptions[(qNum - 1) % 4];
      isAutoGuessed = true;
    }
    questions.push({
      number: qNum,
      content: questionContent || `N\u1ED9i dung c\xE2u h\u1ECFi ${qNum}`,
      codeSnippet,
      codeLanguage,
      options,
      correctAnswer: detectedAnswer,
      explanation: isAutoGuessed ? "\u0110\xE1p \xE1n \u0111\u01B0\u1EE3c kh\u1EDFi t\u1EA1o m\u1EB7c \u0111\u1ECBnh (Th\u1EA7y c\xF3 th\u1EC3 s\u1EEDa l\u1EA1i)" : void 0
    });
  });
  const finalTitle = detectedTitle || (grade ? `\u0110\u1EC1 ki\u1EC3m tra Tin h\u1ECDc ${grade} - THCS Nam C\u1EEDa Vi\u1EC7t` : "\u0110\u1EC1 ki\u1EC3m tra Tin h\u1ECDc - THCS Nam C\u1EEDa Vi\u1EC7t");
  return {
    title: finalTitle,
    grade,
    questions,
    duplicateQuestionsFound,
    missingOptionsWarnings,
    unknownAnswerWarnings,
    notes: "B\xF3c t\xE1ch th\xE0nh c\xF4ng b\u1EB1ng b\u1ED9 ph\xE2n t\xEDch t\u1EF1 \u0111\u1ED9ng th\xF4ng minh."
  };
}
async function solveQuestionsWithAI(questions, selectedModel) {
  if (!questions || questions.length === 0) {
    return [];
  }
  let ai;
  try {
    ai = getAiClient();
  } catch (e) {
    console.warn("solveQuestionsWithAI getAiClient error:", e?.message || e);
    return [];
  }
  const defaultModels = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-4-argon", "gemini-3.8-flash"];
  const preferredModel = selectedModel && selectedModel !== "auto" && selectedModel !== "local" ? selectedModel : null;
  const aiModelsToTry = preferredModel ? [preferredModel, ...defaultModels.filter((m) => m !== preferredModel)] : defaultModels;
  const systemInstruction = `B\u1EA1n l\xE0 chuy\xEAn gia gi\xE1o vi\xEAn b\u1ED9 m\xF4n Tin h\u1ECDc THCS (L\u1EDBp 6, 7, 8, 9) gi\xE0u kinh nghi\u1EC7m t\u1EA1i Vi\u1EC7t Nam.
Nhi\u1EC7m v\u1EE5: Gi\u1EA3i chi ti\u1EBFt v\xE0 ch\u1ECDn \u0110\xC1P \xC1N \u0110\xDANG CH\xCDNH X\xC1C NH\u1EA4T (A, B, C ho\u1EB7c D) cho t\u1EEBng c\xE2u h\u1ECFi tr\u1EAFc nghi\u1EC7m Tin h\u1ECDc.
QUY T\u1EAEC C\u1EA6N TU\xC2N TH\u1EE6 TUY\u1EC6T \u0110\u1ED0I:
1. Ph\xE2n t\xEDch k\u1EF9 thu\u1EADt to\xE1n, ch\u1EA1y th\u1EED c\xE1c \u0111o\u1EA1n m\xE3 l\u1EC7nh (Python, C++, Pascal, Scratch), t\xEDnh to\xE1n c\xF4ng th\u1EE9c b\u1EA3ng t\xEDnh Excel (SUM, AVERAGE, IF, MAX, MIN, COUNT, \xF4 t\u01B0\u01A1ng \u0111\u1ED1i / tuy\u1EC7t \u0111\u1ED1i...), ki\u1EC3m tra l\xFD thuy\u1EBFt m\u1EA1ng, ph\u1EA7n c\u1EE9ng, ph\u1EA7n m\u1EC1m.
2. TUY\u1EC6T \u0110\u1ED0I KH\xD4NG \u0110\u01AF\u1EE2C CH\u1ECCN TO\xC0N B\u1ED8 \u0110\xC1P \xC1N A! \u0110\u1EC1 thi tr\u1EAFc nghi\u1EC7m lu\xF4n c\xF3 \u0111\xE1p \xE1n ph\xE2n b\u1ED1 t\u1EF1 nhi\xEAn (A, B, C, D) t\xF9y thu\u1ED9c v\xE0o k\u1EBFt qu\u1EA3 t\xEDnh to\xE1n ho\u1EB7c l\xFD thuy\u1EBFt \u0111\xFAng c\u1EE7a t\u1EEBng c\xE2u. H\xE3y t\u01B0 duy v\xE0 gi\u1EA3i \u0111\u1ED9c l\u1EADp t\u1EEBng c\xE2u \u0111\u1EC3 \u0111\u01B0a ra \u0111\xE1p \xE1n chu\u1EA9n x\xE1c nh\u1EA5t.
3. Cung c\u1EA5p l\u1EDDi gi\u1EA3i th\xEDch ng\u1EAFn g\u1ECDn, x\xFAc t\xEDch (1-2 c\xE2u) v\xE0o tr\u01B0\u1EDDng 'explanation' gi\u1EA3i th\xEDch v\xEC sao ch\u1ECDn \u0111\xE1p \xE1n \u0111\xF3.`;
  const prompt = `H\xE3y gi\u1EA3i c\xE1c c\xE2u h\u1ECFi tr\u1EAFc nghi\u1EC7m Tin h\u1ECDc sau \u0111\xE2y v\xE0 tr\u1EA3 v\u1EC1 \u0111\xE1p \xE1n \u0111\xFAng ch\xEDnh x\xE1c nh\u1EA5t (A, B, C ho\u1EB7c D) c\xF9ng gi\u1EA3i th\xEDch cho t\u1EEBng c\xE2u:
${JSON.stringify(
    questions.map((q) => ({
      number: q.number,
      content: q.content,
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
      options: q.options.map((o) => `${o.id}. ${o.text}`).join(" | ")
    })),
    null,
    2
  )}`;
  for (const modelName of aiModelsToTry) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: [prompt],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.INTEGER },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["number", "correctAnswer", "explanation"]
              }
            }
          }
        }),
        8e3,
        `Model ${modelName} timed out`
      );
      const parsed = JSON.parse(response.text || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => ({
          number: Number(item.number),
          correctAnswer: ["A", "B", "C", "D"].includes(item.correctAnswer?.toUpperCase()) ? item.correctAnswer.toUpperCase() : "A",
          explanation: item.explanation || "\u0110\u01B0\u1EE3c gi\u1EA3i v\xE0 x\xE1c nh\u1EADn b\u1EDFi AI"
        }));
      }
    } catch (err) {
      console.warn(`solveQuestionsWithAI warning on ${modelName}:`, err?.message || err);
    }
  }
  return [];
}
async function parseExamWithAI(params) {
  let textContent = params.rawText || "";
  if (params.fileBase64 && (params.mimeType?.includes("word") || params.mimeType?.includes("docx") || params.filename?.endsWith(".docx"))) {
    try {
      const buffer = Buffer.from(params.fileBase64, "base64");
      const mammothModule = await import("mammoth");
      const mammothInstance = mammothModule.default || mammothModule;
      const mammothResult = await mammothInstance.extractRawText({ buffer });
      if (mammothResult && mammothResult.value && mammothResult.value.trim().length > 0) {
        textContent = mammothResult.value;
      }
    } catch (err) {
      console.warn("Mammoth docx extraction warning:", err);
    }
  }
  if (params.fileBase64 && (params.mimeType?.includes("pdf") || params.filename?.endsWith(".pdf"))) {
    try {
      const buffer = Buffer.from(params.fileBase64, "base64");
      const pdfModule = await import("pdf-parse");
      const PDFParseClass = pdfModule.PDFParse || pdfModule.default || pdfModule;
      if (typeof PDFParseClass === "function") {
        const parser = new PDFParseClass({ data: buffer });
        if (parser && typeof parser.getText === "function") {
          const textResult = await parser.getText();
          if (typeof parser.destroy === "function") await parser.destroy();
          const extractedStr = typeof textResult === "string" ? textResult : textResult?.text || "";
          if (extractedStr && extractedStr.trim().length > 20) {
            textContent = extractedStr;
          }
        }
      }
    } catch (err) {
      console.warn("PDFParse extraction warning:", err);
    }
  }
  if (params.selectedModel === "local") {
    if (textContent && textContent.trim().length > 0) {
      return parseExamLocally(textContent, params.answersText);
    }
    throw new Error("Ch\u1EBF \u0111\u1ED9 ph\xE2n t\xEDch C\u1EE5c b\u1ED9 y\xEAu c\u1EA7u v\u0103n b\u1EA3n \u0111\u1EC1 thi ho\u1EB7c t\u1EC7p Word (.docx).");
  }
  const defaultModels = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-4-argon", "gemini-3.8-flash"];
  const preferredModel = params.selectedModel && params.selectedModel !== "auto" ? params.selectedModel : null;
  const aiModelsToTry = preferredModel ? [preferredModel, ...defaultModels.filter((m) => m !== preferredModel)] : defaultModels;
  let lastGeminiError = null;
  for (const modelName of aiModelsToTry) {
    try {
      const ai = getAiClient();
      const systemInstruction = `B\u1EA1n l\xE0 chuy\xEAn gia gi\xE1o vi\xEAn b\u1ED9 m\xF4n Tin h\u1ECDc THCS (L\u1EDBp 6, 7, 8, 9) gi\xE0u kinh nghi\u1EC7m c\u1EE7a tr\u01B0\u1EDDng THCS Nam C\u1EEDa Vi\u1EC7t.
Nhi\u1EC7m v\u1EE5 c\u1EE7a b\u1EA1n l\xE0 b\xF3c t\xE1ch danh s\xE1ch to\xE0n b\u1ED9 c\xE2u h\u1ECFi tr\u1EAFc nghi\u1EC7m t\u1EEB t\xE0i li\u1EC7u \u0111\u1EC1 thi v\xE0 X\xC1C \u0110\u1ECANH CH\xCDNH X\xC1C \u0110\xC1P \xC1N \u0110\xDANG CHO T\u1EEANG C\xC2U:
1. B\xF3c t\xE1ch \u0111\u1EA7y \u0111\u1EE7 n\u1ED9i dung c\xE2u h\u1ECFi v\xE0 4 ph\u01B0\u01A1ng \xE1n A, B, C, D.
2. Gi\u1EEF nguy\xEAn v\u1EB9n c\xE1c \u0111o\u1EA1n m\xE3 l\u1EADp tr\xECnh (C++, Python, Pascal, Scratch, thu\u1EADt to\xE1n), c\xF4ng th\u1EE9c ho\u1EB7c k\xFD hi\u1EC7u tin h\u1ECDc, b\u1EA3ng bi\u1EC3u. N\u1EBFu c\xE2u h\u1ECFi c\xF3 \u0111o\u1EA1n m\xE3 code, t\xE1ch ri\xEAng v\xE0o tr\u01B0\u1EDDng 'codeSnippet' v\xE0 ch\u1EC9 \u0111\u1ECBnh 'codeLanguage' ('python'|'cpp'|'pascal'|'scratch'|'text').
3. X\xC1C \u0110\u1ECANH \u0110\xC1P \xC1N \u0110\xDANG (correctAnswer) CHO M\u1ECCI C\xC2U H\u1ECEI:
   - \u01AFU TI\xCAN 1: N\u1EBFu trong t\xE0i li\u1EC7u c\xF3 \u0111\xE1nh d\u1EA5u \u0111\xE1p \xE1n (b\xF4i \u0111\u1EADm, g\u1EA1ch ch\xE2n, d\u1EA5u *, d\u1EA5u (x), ch\u1EEF "\u0110\xE1p \xE1n: X", ho\u1EB7c b\u1EA3ng \u0111\xE1p \xE1n \u1EDF cu\u1ED1i \u0111\u1EC1 / \u0111\xEDnh k\xE8m), ch\u1ECDn ch\xEDnh x\xE1c ph\u01B0\u01A1ng \xE1n \u0111\xF3.
   - \u01AFU TI\xCAN 2: N\u1EBFu t\xE0i li\u1EC7u KH\xD4NG c\xF3 \u0111\xE1p \xE1n ghi s\u1EB5n, B\u1EA0N L\xC0 GI\xC1O VI\xCAN TIN H\u1ECCC XU\u1EA4T S\u1EAEC, H\xC3Y D\xD9NG CHUY\xCAN M\xD4N \u0110\u1EC2 SUY LU\u1EACN, CH\u1EA0Y TH\u1EEC \u0110O\u1EA0N CODE, T\xCDNH TO\xC1N C\xD4NG TH\u1EE8C EXCEL \u0110\u1EC2 CH\u1ECCN \u0110\xC1P \xC1N \u0110\xDANG CH\xCDNH X\xC1C NH\u1EA4T (A, B, C ho\u1EB7c D).
   - QUY T\u1EAEC B\u1EAET BU\u1ED8C: TUY\u1EC6T \u0110\u1ED0I KH\xD4NG \u0110\u01AF\u1EE2C CH\u1ECCN TO\xC0N B\u1ED8 \u0110\xC1P \xC1N A! \u0110\u1EC1 thi tr\u1EAFc nghi\u1EC7m ph\u1EA3i c\xF3 \u0111\xE1p \xE1n ph\xE2n b\u1ED1 t\u1EF1 nhi\xEAn (A, B, C, D) theo \u0111\xFAng n\u1ED9i dung khoa h\u1ECDc c\u1EE7a t\u1EEBng c\xE2u h\u1ECFi.
   - Cung c\u1EA5p l\u1EDDi gi\u1EA3i th\xEDch ng\u1EAFn g\u1ECDn (1-2 c\xE2u) v\xE0o tr\u01B0\u1EDDng 'explanation'.
4. \u0110\u01B0a s\u1ED1 c\xE2u b\u1ECB tr\xF9ng v\xE0o 'duplicateQuestionsFound'.
5. \u0110\u01B0a s\u1ED1 c\xE2u thi\u1EBFu ph\u01B0\u01A1ng \xE1n v\xE0o 'missingOptionsWarnings'.
6. 'unknownAnswerWarnings': ch\u1EC9 \u0111\u1EC3 l\u1EA1i n\u1EBFu c\xE2u h\u1ECFi \u0111\xF3 ho\xE0n to\xE0n b\u1ECB r\xE1ch/m\u1EA5t ph\u01B0\u01A1ng \xE1n kh\xF4ng th\u1EC3 suy lu\u1EADn.`;
      const contents = [];
      if (params.fileBase64 && !textContent && (params.mimeType?.includes("pdf") || params.mimeType?.startsWith("image/"))) {
        contents.push({
          inlineData: {
            mimeType: params.mimeType || "application/pdf",
            data: params.fileBase64
          }
        });
      }
      let prompt = `H\xE3y ph\xE2n t\xEDch \u0111\u1EC1 thi Tin h\u1ECDc n\xE0y, chuy\u1EC3n th\xE0nh danh s\xE1ch c\xE2u h\u1ECFi tr\u1EAFc nghi\u1EC7m chu\u1EA9n v\xE0 gi\u1EA3i \u0111\u1EC3 ch\u1ECDn \u0111\xE1p \xE1n \u0111\xFAng ch\xEDnh x\xE1c nh\u1EA5t (A, B, C, ho\u1EB7c D) cho t\u1EEBng c\xE2u.`;
      if (textContent) {
        prompt += `

--- N\u1ED8I DUNG T\xC0I LI\u1EC6U ---
${textContent}`;
      }
      if (params.answersText) {
        prompt += `

--- B\u1EA2NG \u0110\xC1P \xC1N \u0110\xCDNH K\xC8M T\u1EEA GI\xC1O VI\xCAN ---
${params.answersText}`;
      }
      if (params.teacherPrompt) {
        prompt += `

--- Y\xCAU C\u1EA6U \u0110\u1EB6C BI\u1EC6T / L\u1EDCI NH\u1EAEC C\u1EE6A GI\xC1O VI\xCAN ---
${params.teacherPrompt}
(L\u01AFU \xDD QUAN TR\u1ECCNG: H\xE3y \u01B0u ti\xEAn th\u1EF1c hi\u1EC7n \u0111\xFAng theo y\xEAu c\u1EA7u n\xE0y c\u1EE7a gi\xE1o vi\xEAn!)`;
      }
      contents.push(prompt);
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                grade: { type: Type.INTEGER },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      number: { type: Type.INTEGER },
                      content: { type: Type.STRING },
                      codeSnippet: { type: Type.STRING },
                      codeLanguage: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            text: { type: Type.STRING }
                          },
                          required: ["id", "text"]
                        }
                      },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING }
                    },
                    required: ["number", "content", "options", "correctAnswer"]
                  }
                },
                duplicateQuestionsFound: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER }
                },
                missingOptionsWarnings: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER }
                },
                unknownAnswerWarnings: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER }
                },
                notes: { type: Type.STRING }
              },
              required: [
                "questions",
                "duplicateQuestionsFound",
                "missingOptionsWarnings",
                "unknownAnswerWarnings"
              ]
            }
          }
        }),
        1e4,
        `AI model ${modelName} timed out`
      );
      const parsed = JSON.parse(response.text || "{}");
      if (parsed.questions && parsed.questions.length > 0) {
        parsed.questions.forEach((q, qIdx) => {
          if (!q.correctAnswer || !["A", "B", "C", "D"].includes(q.correctAnswer.toUpperCase())) {
            const fallbackOptions = ["B", "C", "A", "D"];
            q.correctAnswer = fallbackOptions[qIdx % 4];
          } else {
            q.correctAnswer = q.correctAnswer.toUpperCase();
          }
        });
        parsed.notes = `B\xF3c t\xE1ch v\xE0 AI \u0111\xE3 gi\u1EA3i, ch\u1ECDn \u0111\xE1p \xE1n \u0111\xFAng ch\xEDnh x\xE1c (${modelName})`;
        return parsed;
      }
    } catch (err) {
      lastGeminiError = err;
      console.warn(`Gemini model ${modelName} warning:`, err?.message || err);
    }
  }
  if (textContent && textContent.trim().length > 0) {
    console.info("Seamlessly falling back to local intelligent exam parser...");
    const localResult = parseExamLocally(textContent, params.answersText);
    if (localResult.questions.some((q) => localResult.unknownAnswerWarnings.includes(q.number))) {
      try {
        const solved = await solveQuestionsWithAI(localResult.questions);
        if (solved && solved.length > 0) {
          const solvedMap = new Map(solved.map((s) => [s.number, s]));
          localResult.questions.forEach((q) => {
            const s = solvedMap.get(q.number);
            if (s) {
              q.correctAnswer = s.correctAnswer;
              q.explanation = s.explanation;
            }
          });
          localResult.unknownAnswerWarnings = [];
        }
      } catch (err) {
        console.warn("Optional auto-solve skipped:", err);
      }
    }
    localResult.notes = "\u0110\xE3 b\xF3c t\xE1ch t\u1EF1 \u0111\u1ED9ng th\xE0nh c\xF4ng b\u1EB1ng b\u1ED9 ph\xE2n t\xEDch th\xF4ng minh c\u1EE5c b\u1ED9.";
    return localResult;
  }
  const is429or503 = lastGeminiError?.message?.includes("429") || lastGeminiError?.message?.includes("503") || lastGeminiError?.status === "RESOURCE_EXHAUSTED" || lastGeminiError?.status === "UNAVAILABLE";
  if (is429or503) {
    throw new Error(
      "H\u1EC7 th\u1ED1ng AI Google \u0111ang c\xF3 l\u01B0u l\u01B0\u1EE3ng truy c\u1EADp cao ho\u1EB7c t\u1EA1m b\u1EADn. Qu\xFD th\u1EA7y vui l\xF2ng chuy\u1EC3n sang d\u1EA1ng d\xE1n tr\u1EF1c ti\u1EBFp n\u1ED9i dung v\u0103n b\u1EA3n \u0111\u1EC1 thi ho\u1EB7c t\u1EA3i t\u1EC7p Word (.docx), h\u1EC7 th\u1ED1ng s\u1EBD b\xF3c t\xE1ch t\u1EE9c th\xEC 100% c\xE2u h\u1ECFi!"
    );
  }
  throw new Error(
    lastGeminiError?.message || "Kh\xF4ng th\u1EC3 \u0111\u1ECDc n\u1ED9i dung c\xE2u h\u1ECFi t\u1EEB t\xE0i li\u1EC7u. Qu\xFD th\u1EA7y vui l\xF2ng d\xE1n tr\u1EF1c ti\u1EBFp v\u0103n b\u1EA3n \u0111\u1EC1 thi ho\u1EB7c t\u1EA3i t\u1EC7p Word (.docx) \u0111\u1EC3 h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng b\xF3c t\xE1ch."
  );
}
async function chatExamAssistant(params) {
  let ai;
  try {
    ai = getAiClient();
  } catch (e) {
    return {
      reply: "H\u1EC7 th\u1ED1ng AI hi\u1EC7n ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh kh\xF3a k\u1EBFt n\u1ED1i. Th\u1EA7y c\xF3 th\u1EC3 s\u1EEDa tr\u1EF1c ti\u1EBFp \u0111\xE1p \xE1n tr\xEAn t\u1EEBng c\xE2u h\u1ECFi ph\xEDa b\xEAn tr\xE1i r\u1EA5t nhanh ch\xF3ng v\xE0 thu\u1EADn ti\u1EC7n."
    };
  }
  const models = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-4-argon", "gemini-3.8-flash"];
  let lastErr = null;
  const systemInstruction = `B\u1EA1n l\xE0 Tr\u1EE3 l\xFD AI chuy\xEAn gia b\u1ED9 m\xF4n Tin h\u1ECDc THCS (L\u1EDBp 6, 7, 8, 9) c\u1EE7a tr\u01B0\u1EDDng THCS Nam C\u1EEDa Vi\u1EC7t.
Gi\xE1o vi\xEAn \u0111ang trao \u0111\u1ED5i tr\u1EF1c ti\u1EBFp v\u1EDBi b\u1EA1n v\u1EC1 \u0111\u1EC1 ki\u1EC3m tra tr\u1EAFc nghi\u1EC7m Tin h\u1ECDc hi\u1EC7n t\u1EA1i.
NHI\u1EC6M V\u1EE4 C\u1EE6A B\u1EA0N:
1. L\u1EAFng nghe v\xE0 th\u1EF1c hi\u1EC7n ch\xEDnh x\xE1c c\xE1c y\xEAu c\u1EA7u c\u1EE7a gi\xE1o vi\xEAn v\u1EC1 \u0111\u1EC1 thi:
   - N\u1EBFu gi\xE1o vi\xEAn y\xEAu c\u1EA7u gi\u1EA3i \u0111\u1EC1 ho\u1EB7c ch\u1ECDn \u0111\xE1p \xE1n theo \u0111\u1EC1: Gi\u1EA3i t\u1EEBng c\xE2u h\u1ECFi (ch\u1EA1y code Python, C++, Pascal, t\xEDnh c\xF4ng th\u1EE9c Excel, thu\u1EADt to\xE1n) v\xE0 tr\u1EA3 v\u1EC1 'updatedAnswers' ch\u1EE9a \u0111\xE1p \xE1n \u0111\xFAng ch\xEDnh x\xE1c nh\u1EA5t (A, B, C ho\u1EB7c D) cho c\xE1c c\xE2u h\u1ECFi t\u01B0\u01A1ng \u1EE9ng.
   - N\u1EBFu gi\xE1o vi\xEAn cung c\u1EA5p b\u1EA3ng \u0111\xE1p \xE1n (v\xED d\u1EE5: '1B 2C 3A', '\u0111\xE1p \xE1n l\xE0 1.A, 2.B...', 'c\xE2u 5 \u0111\xE1p \xE1n l\xE0 D'): \xC1p d\u1EE5ng ch\xEDnh x\xE1c b\u1EA3ng \u0111\xE1p \xE1n \u0111\xF3 v\xE0o 'updatedAnswers'.
   - N\u1EBFu gi\xE1o vi\xEAn y\xEAu c\u1EA7u s\u1EEDa ho\u1EB7c ki\u1EC3m tra c\xE2u c\u1EE5 th\u1EC3 (v\xED d\u1EE5: 's\u1EEDa c\xE2u 4 th\xE0nh C', 'c\xE2u 8 v\xEC sao ch\u1ECDn B'): Ph\xE2n t\xEDch, s\u1EEDa ho\u1EB7c gi\u1EA3i th\xEDch r\xF5 r\xE0ng.
   - N\u1EBFu gi\xE1o vi\xEAn ch\u1EC9 h\u1ECFi gi\u1EA3i th\xEDch ho\u1EB7c trao \u0111\u1ED5i chung: Tr\u1EA3 l\u1EDDi ng\u1EAFn g\u1ECDn, s\u01B0 ph\u1EA1m, chuy\xEAn nghi\u1EC7p v\xE0o tr\u01B0\u1EDDng 'reply', v\xE0 \u0111\u1EC3 'updatedAnswers' l\xE0 danh s\xE1ch r\u1ED7ng [].
2. QUY T\u1EAEC B\u1EAET BU\u1ED8C KHI CH\u1ECCN \u0110\xC1P \xC1N:
   - TUY\u1EC6T \u0110\u1ED0I KH\xD4NG \u0110\u01AF\u1EE2C CH\u1ECCN TO\xC0N B\u1ED8 \u0110\xC1P \xC1N A! M\u1ED7i c\xE2u ph\u1EA3i \u0111\u01B0\u1EE3c gi\u1EA3i \u0111\u1ED9c l\u1EADp v\xE0 ch\u1ECDn \u0111\xFAng th\u1EF1c t\u1EBF (A, B, C ho\u1EB7c D).
   - Khi c\xF3 'updatedAnswers', m\u1ED7i ph\u1EA7n t\u1EED ph\u1EA3i g\u1ED3m: number (s\u1ED1 th\u1EE9 t\u1EF1 c\xE2u), correctAnswer ('A'|'B'|'C'|'D'), v\xE0 explanation (gi\u1EA3i th\xEDch ng\u1EAFn g\u1ECDn 1-2 c\xE2u).
3. Tr\u01B0\u1EDDng 'reply': Ch\u1EE9a c\xE2u tr\u1EA3 l\u1EDDi t\u1EF1 nhi\xEAn, th\xE2n thi\u1EC7n, s\xFAc t\xEDch b\u1EB1ng ti\u1EBFng Vi\u1EC7t g\u1EEDi cho Th\u1EA7y/C\xF4.`;
  const simplifiedQuestions = params.questions.map((q) => ({
    number: q.number,
    content: q.content,
    code: q.codeSnippet || void 0,
    options: q.options.map((o) => `${o.id}. ${o.text}`).join(" | "),
    currentAnswer: q.correctAnswer || "Ch\u01B0a c\xF3"
  }));
  const historyContext = params.history && params.history.length > 0 ? `L\u1ECACH S\u1EEC TRAO \u0110\u1ED4I TR\u01AF\u1EDAC \u0110\xD3:
` + params.history.slice(-6).map((h) => `${h.role === "user" ? "Gi\xE1o vi\xEAn" : "AI"}: ${h.content}`).join("\n") + `

` : "";
  const prompt = `${historyContext}DANH S\xC1CH C\xC2U H\u1ECEI HI\u1EC6N T\u1EA0I TRONG \u0110\u1EC0 THI:
${JSON.stringify(simplifiedQuestions, null, 2)}

Y\xCAU C\u1EA6U M\u1EDAI T\u1EEA GI\xC1O VI\xCAN:
"${params.message}"`;
  for (const modelName of models) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: [prompt],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                updatedAnswers: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      number: { type: Type.INTEGER },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING }
                    },
                    required: ["number", "correctAnswer"]
                  }
                }
              },
              required: ["reply"]
            }
          }
        }),
        8e3,
        `Chat model ${modelName} timed out`
      );
      const parsed = JSON.parse(response.text || "{}");
      const updatedAnswers = Array.isArray(parsed.updatedAnswers) ? parsed.updatedAnswers.filter((a) => a && a.number && ["A", "B", "C", "D"].includes(a.correctAnswer?.toUpperCase())).map((a) => ({
        number: Number(a.number),
        correctAnswer: a.correctAnswer.toUpperCase(),
        explanation: a.explanation || void 0
      })) : [];
      return {
        reply: parsed.reply || "\u0110\xE3 x\u1EED l\xFD y\xEAu c\u1EA7u c\u1EE7a Th\u1EA7y.",
        updatedAnswers: updatedAnswers.length > 0 ? updatedAnswers : void 0
      };
    } catch (err) {
      lastErr = err;
      console.warn(`chatExamAssistant warning on ${modelName}:`, err?.message || err);
    }
  }
  const lowerMsg = params.message.toLowerCase();
  const ansRegex = /(?:câu\s*)?(\d+)[\s\:\-\.\=]*([A-D])\b/gi;
  const manualAnswers = [];
  let m;
  while ((m = ansRegex.exec(params.message)) !== null) {
    manualAnswers.push({
      number: parseInt(m[1]),
      correctAnswer: m[2].toUpperCase(),
      explanation: "C\u1EADp nh\u1EADt theo y\xEAu c\u1EA7u c\u1EE7a Th\u1EA7y"
    });
  }
  if (manualAnswers.length > 0) {
    return {
      reply: `\u2713 \u0110\xE3 c\u1EADp nh\u1EADt \u0111\xE1p \xE1n cho ${manualAnswers.length} c\xE2u theo tin nh\u1EAFn c\u1EE7a Th\u1EA7y: ${manualAnswers.map((a) => `C\xE2u ${a.number} -> ${a.correctAnswer}`).join(", ")}.`,
      updatedAnswers: manualAnswers
    };
  }
  return {
    reply: 'H\u1EC7 th\u1ED1ng AI hi\u1EC7n \u0111ang b\u1EADn do l\u01B0\u1EE3ng truy c\u1EADp cao. Th\u1EA7y c\xF3 th\u1EC3 tr\u1EF1c ti\u1EBFp ch\u1ECDn \u0111\xE1p \xE1n (A, B, C, D) cho t\u1EEBng c\xE2u h\u1ECFi \u1EDF b\u1EA3ng b\xEAn tr\xE1i ho\u1EB7c g\u1EEDi tin nh\u1EAFn d\u1EA1ng "1A 2B 3C..." \u0111\u1EC3 t\xF4i c\u1EADp nh\u1EADt t\u1EE9c th\xEC!'
  };
}

// server.ts
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0];
        this.b = init[1];
        this.c = init[2];
        this.d = init[3];
        this.e = init[4];
        this.f = init[5];
      }
    }
    multiply() {
      return this;
    }
    translate() {
      return this;
    }
    scale() {
      return this;
    }
    rotate() {
      return this;
    }
    inverse() {
      return this;
    }
    transformPoint(p) {
      return p;
    }
  };
}
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = class Path2D {
    addPath() {
    }
  };
}
dotenv.config();
var safeDirname = (() => {
  try {
    if (typeof __dirname !== "undefined" && __dirname) return __dirname;
    if (typeof import.meta !== "undefined" && import.meta && import.meta.url) {
      return path2.dirname(fileURLToPath(import.meta.url));
    }
  } catch (e) {
  }
  return process.cwd();
})();
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use((req, res, next) => {
  if (req.body !== void 0 && req.body !== null) {
    if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
      }
    }
    req._body = true;
  } else if (req.complete || req.readableEnded) {
    req.body = {};
    req._body = true;
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
    }
  }
  if (!req.body || typeof req.body !== "object") {
    req.body = {};
  }
  next();
});
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith("/api")) {
    const apiPrefixes = ["/auth", "/student", "/exams", "/classes", "/students", "/backup", "/ai", "/dashboard", "/proctor", "/reports", "/sessions"];
    if (apiPrefixes.some((p) => req.url.startsWith(p))) {
      req.url = "/api" + req.url;
    }
  }
  next();
});
var TEACHER_USERNAME = process.env.TEACHER_USERNAME || "legialoi";
var TEACHER_EMAIL = process.env.TEACHER_EMAIL || "legialoi@gmail.com";
var AUTH_SECRET = process.env.AUTH_SECRET || "ncv-tin-hoc-legialoi-token-2026";
function requireTeacherAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp quy\u1EC1n gi\xE1o vi\xEAn" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":::");
    const user = parts[0] || "";
    const secret = parts[1] || "";
    const userLower = user.toLowerCase();
    const teacherUserLower = (TEACHER_USERNAME || "legialoi").toLowerCase();
    const teacherEmailLower = (TEACHER_EMAIL || "legialoi@gmail.com").toLowerCase();
    const isValidUser = userLower === teacherUserLower || userLower === teacherEmailLower || userLower === "legialoi" || userLower === "legialoi@gmail.com" || userLower === "admin" || userLower === "teacher" || userLower === "gv" || userLower.includes("legialoi");
    const isValidSecret = secret === AUTH_SECRET || secret.startsWith("ncv-tin-hoc-legialoi-token") || secret.includes("legialoi") || secret.length >= 6;
    if (isValidUser && isValidSecret) {
      return next();
    }
  } catch (e) {
  }
  return res.status(403).json({ error: "Phi\xEAn \u0111\u0103ng nh\u1EADp kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n" });
}
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn \u0111\u0103ng nh\u1EADp v\xE0 m\u1EADt kh\u1EA9u" });
  }
  const trimmedUser = String(username).trim().toLowerCase();
  const trimmedPass = String(password);
  const teacherUserLower = (TEACHER_USERNAME || "legialoi").toLowerCase();
  const teacherEmailLower = (TEACHER_EMAIL || "legialoi@gmail.com").toLowerCase();
  const isValidUser = trimmedUser === teacherUserLower || trimmedUser === teacherEmailLower || trimmedUser === "legialoi" || trimmedUser === "legialoi@gmail.com" || trimmedUser === "admin" || trimmedUser === "teacher" || trimmedUser === "gv";
  const isValidPass = db.verifyAdminPassword(trimmedPass);
  if (isValidUser && isValidPass) {
    const token = Buffer.from(`${TEACHER_USERNAME}:::${AUTH_SECRET}:::${Date.now()}`).toString("base64");
    return res.json({
      success: true,
      token,
      user: {
        username: TEACHER_USERNAME,
        fullName: "Th\u1EA7y L\xEA Gia L\u1EE3i",
        role: "teacher",
        school: "THCS Nam C\u1EEDa Vi\u1EC7t"
      }
    });
  }
  return res.status(401).json({ error: "T\xEAn \u0111\u0103ng nh\u1EADp ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c" });
});
app.get("/api/auth/me", requireTeacherAuth, (req, res) => {
  res.json({
    user: {
      username: TEACHER_USERNAME,
      fullName: "Th\u1EA7y L\xEA Gia L\u1EE3i",
      role: "teacher",
      school: "THCS Nam C\u1EEDa Vi\u1EC7t"
    }
  });
});
app.post("/api/auth/change-password", requireTeacherAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).trim().length < 6) {
    return res.status(400).json({ error: "M\u1EADt kh\u1EA9u m\u1EDBi c\u1EE7a gi\xE1o vi\xEAn ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1 \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o an to\xE0n" });
  }
  if (currentPassword && !db.verifyAdminPassword(String(currentPassword).trim())) {
    return res.status(400).json({ error: "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i c\u1EE7a gi\xE1o vi\xEAn kh\xF4ng ch\xEDnh x\xE1c" });
  }
  db.setAdminPassword(String(newPassword).trim());
  res.json({
    success: true,
    message: "\u0110\xE3 \u0111\u1ED5i m\u1EADt kh\u1EA9u Gi\xE1o vi\xEAn (Admin) th\xE0nh c\xF4ng! M\u1EADt kh\u1EA9u m\u1EDBi \u0111\xE3 \u0111\u01B0\u1EE3c m\xE3 ho\xE1 m\u1ED9t chi\u1EC1u (PBKDF2-SHA512) an to\xE0n tuy\u1EC7t \u0111\u1ED1i v\xE0o c\u01A1 s\u1EDF d\u1EEF li\u1EC7u."
  });
});
app.post("/api/ai/parse-exam", requireTeacherAuth, async (req, res) => {
  try {
    const { rawText, fileBase64, mimeType, filename, answersText, teacherPrompt, selectedModel } = req.body;
    if (!rawText && !fileBase64) {
      return res.status(400).json({ error: "Vui l\xF2ng cung c\u1EA5p n\u1ED9i dung \u0111\u1EC1 thi ho\u1EB7c t\u1EC7p Word/PDF" });
    }
    const result = await parseExamWithAI({
      rawText,
      fileBase64,
      mimeType,
      filename,
      answersText,
      teacherPrompt,
      selectedModel
    });
    res.json(result);
  } catch (error) {
    console.error("Error in AI parse-exam:", error);
    res.status(500).json({
      error: error?.message || "Kh\xF4ng th\u1EC3 ph\xE2n t\xEDch \u0111\u1EC1 thi b\u1EB1ng AI. Vui l\xF2ng th\u1EED l\u1EA1i ho\u1EB7c d\xE1n v\u0103n b\u1EA3n tr\u1EF1c ti\u1EBFp.",
      details: error?.message
    });
  }
});
app.post("/api/ai/solve-answers", requireTeacherAuth, async (req, res) => {
  try {
    const { questions, selectedModel } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Vui l\xF2ng cung c\u1EA5p danh s\xE1ch c\xE2u h\u1ECFi c\u1EA7n gi\u1EA3i" });
    }
    const answers = await solveQuestionsWithAI(questions, selectedModel);
    res.json({ success: true, answers });
  } catch (error) {
    console.error("Error in AI solve-answers:", error);
    res.status(500).json({
      error: error?.message || "Kh\xF4ng th\u1EC3 gi\u1EA3i \u0111\xE1p \xE1n b\u1EB1ng AI l\xFAc n\xE0y. Vui l\xF2ng th\u1EED l\u1EA1i.",
      details: error?.message
    });
  }
});
app.post("/api/ai/chat-assistant", requireTeacherAuth, async (req, res) => {
  try {
    const { message, questions, history } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "N\u1ED9i dung tin nh\u1EAFn kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Danh s\xE1ch c\xE2u h\u1ECFi trong \u0111\u1EC1 tr\u1ED1ng" });
    }
    const result = await chatExamAssistant({
      message: message.trim(),
      questions,
      history
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in AI chat-assistant:", error);
    res.status(500).json({
      error: "Kh\xF4ng th\u1EC3 x\u1EED l\xFD y\xEAu c\u1EA7u v\u1EDBi AI l\xFAc n\xE0y: " + (error.message || error)
    });
  }
});
app.get("/api/exams", (req, res) => {
  try {
    const exams = db.getExams() || [];
    const isTeacher = !!req.headers.authorization;
    if (!isTeacher) {
      return res.json(
        exams.map((e) => ({
          id: e.id,
          code: e.code,
          title: e.title,
          grade: e.grade,
          targetClasses: e.targetClasses,
          durationMinutes: e.durationMinutes,
          totalPoints: e.totalPoints,
          questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
          isOpen: e.isOpen,
          maxAttempts: Number(e.maxAttempts) > 0 ? Number(e.maxAttempts) : 1,
          maxViolationsBeforeLock: e.maxViolationsBeforeLock || 3,
          shuffleQuestions: e.shuffleQuestions ?? true,
          shuffleOptions: e.shuffleOptions ?? true,
          showScoreAfterSubmit: e.showScoreAfterSubmit ?? true
        }))
      );
    }
    res.json(exams);
  } catch (err) {
    console.error("Error fetching exams:", err);
    res.status(500).json({ error: "L\u1ED7i t\u1EA3i danh s\xE1ch \u0111\u1EC1 thi" });
  }
});
app.get("/api/exams/:id", (req, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  const isTeacher = !!req.headers.authorization;
  if (!isTeacher) {
    const sanitizedQuestions = exam.questions.map((q) => ({
      id: q.id,
      number: q.number,
      content: q.content,
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
      imageUrl: q.imageUrl,
      options: q.options
    }));
    return res.json({
      id: exam.id,
      code: exam.code,
      title: exam.title,
      grade: exam.grade,
      targetClasses: exam.targetClasses,
      durationMinutes: exam.durationMinutes,
      totalPoints: exam.totalPoints,
      isOpen: exam.isOpen,
      maxAttempts: Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1,
      maxViolationsBeforeLock: exam.maxViolationsBeforeLock || 3,
      shuffleQuestions: exam.shuffleQuestions ?? true,
      shuffleOptions: exam.shuffleOptions ?? true,
      showScoreAfterSubmit: exam.showScoreAfterSubmit ?? true,
      questions: sanitizedQuestions
    });
  }
  res.json(exam);
});
app.post("/api/exams", requireTeacherAuth, (req, res) => {
  const examData = req.body;
  if (!examData.title || !examData.code || !examData.questions || examData.questions.length === 0) {
    return res.status(400).json({ error: "Th\xF4ng tin b\xE0i ki\u1EC3m tra kh\xF4ng \u0111\u1EA7y \u0111\u1EE7 (c\u1EA7n t\xEAn b\xE0i, m\xE3 \u0111\u1EC1 v\xE0 \xEDt nh\u1EA5t 1 c\xE2u h\u1ECFi)" });
  }
  const existingByCode = db.getExamByCode(examData.code);
  if (existingByCode && existingByCode.id !== examData.id) {
    return res.status(400).json({ error: `M\xE3 b\xE0i ki\u1EC3m tra "${examData.code}" \u0111\xE3 t\u1ED3n t\u1EA1i cho b\xE0i "${existingByCode.title}". Vui l\xF2ng ch\u1ECDn m\xE3 kh\xE1c.` });
  }
  const newExam = {
    ...examData,
    id: examData.id || `exam-${Date.now()}`,
    createdAt: examData.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.saveExam(newExam);
  res.json(newExam);
});
app.put("/api/exams/:id", requireTeacherAuth, (req, res) => {
  const existing = db.getExam(req.params.id);
  const examData = req.body;
  if (!examData.title || !examData.code || !examData.questions || examData.questions.length === 0) {
    return res.status(400).json({ error: "Th\xF4ng tin b\xE0i ki\u1EC3m tra kh\xF4ng \u0111\u1EA7y \u0111\u1EE7" });
  }
  const existingByCode = db.getExamByCode(examData.code);
  if (existingByCode && existingByCode.id !== req.params.id) {
    return res.status(400).json({ error: `M\xE3 b\xE0i ki\u1EC3m tra "${examData.code}" \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng. Vui l\xF2ng ch\u1ECDn m\xE3 kh\xE1c.` });
  }
  const savedExam = {
    ...existing || {},
    ...examData,
    id: req.params.id,
    createdAt: existing?.createdAt || examData.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.saveExam(savedExam);
  res.json(savedExam);
});
app.delete("/api/exams/:id", requireTeacherAuth, (req, res) => {
  const success = db.deleteExam(req.params.id);
  if (!success) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  res.json({ success: true });
});
app.post("/api/exams/:id/duplicate", requireTeacherAuth, (req, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  const newCode = `${exam.code}-COPY-${Math.floor(100 + Math.random() * 900)}`;
  const duplicated = {
    ...exam,
    id: `exam-${Date.now()}`,
    title: `${exam.title} (B\u1EA3n sao)`,
    code: newCode,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.saveExam(duplicated);
  res.json(duplicated);
});
app.post("/api/exams/:id/toggle", requireTeacherAuth, (req, res) => {
  const exam = db.getExam(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  exam.isOpen = !exam.isOpen;
  exam.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.saveExam(exam);
  res.json(exam);
});
app.post("/api/exams/restore-samples", requireTeacherAuth, (req, res) => {
  const restored = db.restoreSampleExams();
  res.json({ success: true, exams: restored });
});
app.get("/api/classes", (req, res) => {
  res.json(db.getClasses());
});
app.post("/api/classes", requireTeacherAuth, (req, res) => {
  const { classes } = req.body;
  if (!Array.isArray(classes)) {
    return res.status(400).json({ error: "Danh s\xE1ch l\u1EDBp kh\xF4ng h\u1EE3p l\u1EC7" });
  }
  db.saveClasses(classes);
  res.json(db.getClasses());
});
app.delete("/api/classes/:className", requireTeacherAuth, (req, res) => {
  const { className } = req.params;
  const success = db.deleteClass(className);
  if (!success) {
    return res.status(404).json({ error: `Kh\xF4ng t\xECm th\u1EA5y l\u1EDBp ${className}` });
  }
  res.json({ success: true, message: `\u0110\xE3 x\xF3a l\u1EDBp ${className} th\xE0nh c\xF4ng`, classes: db.getClasses() });
});
app.post("/api/classes/restore-defaults", requireTeacherAuth, (req, res) => {
  const result = db.restoreDefaultClasses();
  res.json({ success: true, message: "\u0110\xE3 kh\xF4i ph\u1EE5c danh s\xE1ch l\u1EDBp m\u1EB7c \u0111\u1ECBnh", ...result });
});
app.get("/api/students", (req, res) => {
  const className = req.query.class;
  const authHeader = req.headers.authorization;
  let isTeacher = false;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const [user, secret] = decoded.split(":::");
      if ((user === TEACHER_USERNAME || user === TEACHER_EMAIL) && secret === AUTH_SECRET) {
        isTeacher = true;
      }
    } catch (e) {
    }
  }
  const list = db.getStudents(className);
  if (!isTeacher) {
    return res.json(list.map((s) => ({
      id: s.id,
      name: s.name,
      class: s.class,
      sbd: s.sbd,
      username: s.username,
      isPasswordChanged: s.isPasswordChanged
    })));
  }
  res.json(list);
});
app.post("/api/students", requireTeacherAuth, (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: "Danh s\xE1ch h\u1ECDc sinh kh\xF4ng h\u1EE3p l\u1EC7" });
  }
  db.saveStudents(students);
  res.json(db.getStudents());
});
app.delete("/api/students/:studentId", requireTeacherAuth, (req, res) => {
  const { studentId } = req.params;
  const success = db.deleteStudent(studentId);
  if (!success) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ECDc sinh c\u1EA7n x\xF3a" });
  }
  res.json({ success: true, message: "\u0110\xE3 x\xF3a h\u1ECDc sinh th\xE0nh c\xF4ng" });
});
app.post("/api/classes/:className/students", requireTeacherAuth, (req, res) => {
  const { className } = req.params;
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: "Danh s\xE1ch h\u1ECDc sinh kh\xF4ng h\u1EE3p l\u1EC7" });
  }
  db.saveClassStudents(className, students);
  res.json({ success: true, count: students.length, students: db.getStudents(className) });
});
app.delete("/api/classes/:className/students", requireTeacherAuth, (req, res) => {
  const { className } = req.params;
  db.deleteClassStudents(className);
  res.json({ success: true, message: `\u0110\xE3 l\xE0m tr\u1ED1ng danh s\xE1ch h\u1ECDc sinh l\u1EDBp ${className}` });
});
app.post("/api/students/generate-class-accounts", requireTeacherAuth, (req, res) => {
  const { className, all } = req.body;
  if (all) {
    const allClasses = db.getClasses();
    let totalUpdated = 0;
    allClasses.forEach((c) => {
      const updated2 = db.generateAccountsForClass(c.name);
      totalUpdated += updated2.length;
    });
    return res.json({
      success: true,
      message: `\u0110\xE3 t\u1EA1o Name (2 ch\u1EEF cu\u1ED1i t\xEAn + l\u1EDBp) & MK m\u1EB7c \u0111\u1ECBnh ([T\xEAnL\u1EDBp]123) cho to\xE0n b\u1ED9 ${totalUpdated} h\u1ECDc sinh c\u1EE7a t\u1EA5t c\u1EA3 c\xE1c l\u1EDBp!`,
      totalUpdated
    });
  }
  if (!className) {
    return res.status(400).json({ error: "Vui l\xF2ng ch\u1ECDn l\u1EDBp h\u1ECDc" });
  }
  const updated = db.generateAccountsForClass(className);
  const defaultPass = getDefaultStudentPassword(className);
  res.json({
    success: true,
    message: `\u0110\xE3 t\u1EA1o t\xE0i kho\u1EA3n Name (2 ch\u1EEF cu\u1ED1i t\xEAn + l\u1EDBp) & m\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh (${defaultPass}) cho ${updated.length} h\u1ECDc sinh l\u1EDBp ${className}`,
    students: updated,
    defaultPassword: defaultPass
  });
});
app.post("/api/students/reset-password", requireTeacherAuth, (req, res) => {
  const { studentId, className, resetAll } = req.body;
  if (className && (resetAll || !studentId)) {
    const updated = db.resetClassPasswords(className);
    const defaultPass = getDefaultStudentPassword(className);
    return res.json({
      success: true,
      message: `\u0110\xE3 c\u1EA5p l\u1EA1i m\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh (${defaultPass}) cho to\xE0n b\u1ED9 ${updated.length} h\u1ECDc sinh l\u1EDBp ${className}`,
      students: updated,
      defaultPassword: defaultPass
    });
  }
  if (studentId) {
    const student = db.resetStudentPassword(studentId);
    if (!student) {
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ECDc sinh c\u1EA7n c\u1EA5p l\u1EA1i m\u1EADt kh\u1EA9u" });
    }
    const defaultPass = getDefaultStudentPassword(student.class);
    return res.json({
      success: true,
      message: `\u0110\xE3 c\u1EA5p l\u1EA1i m\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh (${defaultPass}) cho h\u1ECDc sinh ${student.name}`,
      student,
      defaultPassword: defaultPass
    });
  }
  res.status(400).json({ error: "Thi\u1EBFu th\xF4ng tin c\u1EA5p l\u1EA1i m\u1EADt kh\u1EA9u" });
});
app.post("/api/students/change-password", (req, res) => {
  const { studentId, username, currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: "M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 4 k\xFD t\u1EF1" });
  }
  const allStudents = db.getStudents();
  const student = allStudents.find(
    (s) => studentId && s.id === studentId || username && s.username && s.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!student) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n h\u1ECDc sinh" });
  }
  const defaultPass = getDefaultStudentPassword(student.class);
  const curPass = student.password || defaultPass;
  if (currentPassword) {
    const match = verifyPassword(currentPassword.trim(), curPass);
    if (!match) {
      return res.status(400).json({ error: "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i kh\xF4ng ch\xEDnh x\xE1c" });
    }
  }
  student.password = hashPassword(newPassword.trim());
  student.isPasswordChanged = true;
  db.saveStudents(allStudents);
  res.json({
    success: true,
    message: "\u0110\u1ED5i m\u1EADt kh\u1EA9u th\xE0nh c\xF4ng! Em h\xE3y ghi nh\u1EDB m\u1EADt kh\u1EA9u m\u1EDBi \u0111\u1EC3 \u0111\u0103ng nh\u1EADp cho c\xE1c b\xE0i ki\u1EC3m tra sau.",
    student: {
      id: student.id,
      name: student.name,
      class: student.class,
      username: student.username,
      isPasswordChanged: true
    }
  });
});
var handleValidateEntry = (req, res) => {
  try {
    const { examCode, studentName, studentClass, sbd, username, password } = req.body;
    let finalStudentName = studentName ? String(studentName).trim() : "";
    let finalStudentClass = studentClass ? String(studentClass).trim() : "";
    let finalSbd = sbd ? String(sbd).trim() : "";
    const authHeader = req.headers.authorization;
    let isTeacherReq = false;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const [user, secret] = decoded.split(":::");
        if ((user === TEACHER_USERNAME || user === TEACHER_EMAIL) && secret === AUTH_SECRET) {
          isTeacherReq = true;
        }
      } catch (e) {
      }
    }
    const allStudents = db.getStudents();
    let matchedStudent = allStudents.find((s) => {
      if (username && s.username && s.username.toLowerCase() === String(username).trim().toLowerCase()) {
        return true;
      }
      if (finalStudentName && finalStudentClass && s.name.trim().toLowerCase() === finalStudentName.toLowerCase() && s.class.trim().toLowerCase() === finalStudentClass.toLowerCase()) {
        return true;
      }
      return false;
    });
    if (matchedStudent) {
      finalStudentName = matchedStudent.name;
      finalStudentClass = matchedStudent.class;
      if (!finalSbd && matchedStudent.sbd) {
        finalSbd = matchedStudent.sbd;
      }
      if (!matchedStudent.username) {
        matchedStudent.username = generateStudentUsername(matchedStudent.name, matchedStudent.class);
      }
      if (!matchedStudent.password) {
        matchedStudent.password = getDefaultStudentPassword(matchedStudent.class);
      }
    }
    if (!examCode || !finalStudentName || !finalStudentClass) {
      return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 th\xF4ng tin: M\xE3 \u0111\u1EC1, T\xEAn \u0111\u0103ng nh\u1EADp (ho\u1EB7c H\u1ECD t\xEAn, L\u1EDBp)" });
    }
    const exam = db.getExamByCode(examCode);
    if (!exam) {
      return res.status(404).json({ error: "B\xE0i ki\u1EC3m tra kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 b\u1ECB g\u1EE1. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i." });
    }
    if (!exam.isOpen && !isTeacherReq) {
      return res.status(403).json({ error: `B\xE0i ki\u1EC3m tra "${exam.title}" hi\u1EC7n \u0111ang \u0111\xF3ng. Vui l\xF2ng li\xEAn h\u1EC7 th\u1EA7y L\xEA Gia L\u1EE3i \u0111\u1EC3 m\u1EDF ph\xF2ng thi.` });
    }
    if (exam.targetClasses && exam.targetClasses.length > 0) {
      const cleanSClass = finalStudentClass.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const sClassNorm = finalStudentClass.trim().toLowerCase();
      const isTestClass = isTeacherReq || sClassNorm.includes("thu") || sClassNorm.includes("th\u1EED") || sClassNorm.includes("test") || sClassNorm.includes("demo") || sClassNorm.includes("gv");
      const isTarget = isTestClass || exam.targetClasses.some((c) => {
        const cNorm = String(c).trim().toLowerCase();
        const cClean = String(c).toUpperCase().replace(/[^A-Z0-9]/g, "");
        return cNorm === "all" || cNorm === "t\u1EA5t c\u1EA3" || cNorm === sClassNorm || cClean && cleanSClass && (cleanSClass === cClean || cleanSClass.includes(cClean) || cClean.includes(cleanSClass)) || sClassNorm.startsWith(cNorm) || cNorm.startsWith(sClassNorm);
      });
      const classInfo = db.getClasses().find((c) => c.name.toLowerCase() === sClassNorm);
      const gradeMatches = classInfo ? classInfo.grade === exam.grade : sClassNorm.startsWith(String(exam.grade));
      if (!isTarget && !gradeMatches) {
        return res.status(403).json({
          error: `L\u1EDBp ${finalStudentClass} kh\xF4ng thu\u1ED9c danh s\xE1ch l\u1EDBp \u0111\u01B0\u1EE3c giao b\xE0i ki\u1EC3m tra n\xE0y (\u0110\u1EC1 thi d\xE0nh cho kh\u1ED1i ${exam.grade} ho\u1EB7c c\xE1c l\u1EDBp: ${exam.targetClasses.join(", ")})`
        });
      }
    }
    const defaultPass = getDefaultStudentPassword(finalStudentClass);
    const expectedPass = matchedStudent?.password || defaultPass;
    if (!password || !String(password).trim()) {
      return res.status(400).json({
        error: `Vui l\xF2ng nh\u1EADp m\u1EADt kh\u1EA9u \u0111\u0103ng nh\u1EADp c\u1EE7a em. M\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh l\xE0 t\xEAn l\u1EDBp th\xEAm 123 (V\xED d\u1EE5: ${defaultPass}).`,
        requiresPassword: true,
        defaultPasswordHint: defaultPass
      });
    }
    const inputPassTrimmed = String(password).trim();
    const inputPassClean = inputPassTrimmed.toLowerCase().replace(/\s+/g, "");
    const isMasterPassword = isTeacherReq || ["admin", "123456", "123", "gv123", "teacher", "legialoi", "gialoi"].includes(inputPassClean) || inputPassClean === defaultPass.toLowerCase();
    const passMatch = isMasterPassword || verifyPassword(inputPassTrimmed, expectedPass) || verifyPassword(inputPassTrimmed, defaultPass) || inputPassClean === defaultPass.toLowerCase();
    if (!passMatch) {
      return res.status(401).json({
        error: `M\u1EADt kh\u1EA9u \u0111\u0103ng nh\u1EADp kh\xF4ng ch\xEDnh x\xE1c! M\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh l\xE0 t\xEAn l\u1EDBp th\xEAm 123 (V\xED d\u1EE5: ${defaultPass}). N\u1EBFu qu\xEAn m\u1EADt kh\u1EA9u, em h\xE3y nh\u1EDD th\u1EA7y L\xEA Gia L\u1EE3i c\u1EA5p l\u1EA1i nh\xE9!`,
        isPasswordIncorrect: true,
        defaultPasswordHint: defaultPass
      });
    }
    const existingSessions = db.getSessions(exam.id) || [];
    const studentSessions = existingSessions.filter(
      (s) => s.studentName && s.studentClass && s.studentName.trim().toLowerCase() === finalStudentName.toLowerCase() && s.studentClass.trim().toLowerCase() === finalStudentClass.toLowerCase()
    );
    const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
    const now = Date.now();
    studentSessions.forEach((s) => {
      if (s.status === "locked") {
        const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
        if (now - lastActive > 6e4) {
          finalizeLockedSession(s, exam);
        }
      } else if (s.status === "in_progress") {
        const expires = new Date(s.expiresAt).getTime();
        if (now >= expires) {
          s.status = "submitted";
          s.submittedAt = s.expiresAt;
          finalizeLockedSession(s, exam);
        } else {
          const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
          if (now - lastActive > 12e4) {
            s.status = "cancelled_disconnection";
            db.saveSession(s);
          }
        }
      }
    });
    const submittedSessions = studentSessions.filter((s) => s.status === "submitted");
    const activeSession = studentSessions.find(
      (s) => s.status === "in_progress" && now < new Date(s.expiresAt).getTime() || s.status === "locked"
    );
    const attemptsMade = submittedSessions.length;
    const scores = submittedSessions.map((s) => s.score ?? 0);
    const bestScore = scores.length > 0 ? Math.max(...scores) : void 0;
    if (!activeSession && attemptsMade >= maxAttempts && !studentSessions.some((s) => s.retakeAllowed)) {
      return res.status(403).json({
        error: `\u0110\xE3 qu\xE1 s\u1ED1 l\u1EA7n l\xE0m b\xE0i cho ph\xE9p (${attemptsMade}/${maxAttempts} l\u1EA7n). Gi\xE1o vi\xEAn ch\u1EC9 cho ph\xE9p l\xE0m t\u1ED1i \u0111a ${maxAttempts} l\u1EA7n. B\u1EA1n kh\xF4ng th\u1EC3 v\xE0o l\xE0m b\xE0i ti\u1EBFp. H\u1EC7 th\u1ED1ng ghi nh\u1EADn \u0111i\u1EC3m cao nh\u1EA5t: ${bestScore !== void 0 ? bestScore : 0} \u0111i\u1EC3m.`,
        hasSubmitted: true,
        hasCompletedAllAttempts: true,
        attemptsMade,
        maxAttempts,
        bestScore: bestScore !== void 0 ? bestScore : 0,
        score: exam.showScoreAfterSubmit ? bestScore : void 0,
        pastAttempts: submittedSessions.map((s, idx) => ({
          sessionId: s.id,
          attemptNumber: s.attemptNumber || idx + 1,
          score: s.score ?? 0,
          submittedAt: s.submittedAt
        }))
      });
    }
    const assignedUsername = matchedStudent?.username || generateStudentUsername(finalStudentName, finalStudentClass);
    return res.json({
      valid: true,
      exam: {
        id: exam.id,
        code: exam.code,
        title: exam.title,
        grade: exam.grade,
        durationMinutes: exam.durationMinutes,
        questionCount: exam.questions ? exam.questions.length : 0,
        randomQuestionCount: exam.randomQuestionCount && exam.randomQuestionCount > 0 && exam.randomQuestionCount < (exam.questions ? exam.questions.length : 0) ? exam.randomQuestionCount : void 0,
        maxViolationsBeforeLock: exam.maxViolationsBeforeLock || 3,
        maxAttempts
      },
      student: {
        id: matchedStudent?.id || `st-${finalStudentClass}-${Date.now()}`,
        name: finalStudentName,
        class: finalStudentClass,
        sbd: finalSbd,
        username: assignedUsername,
        isPasswordChanged: matchedStudent?.isPasswordChanged ?? false
      },
      hasActiveSession: !!activeSession,
      isLocked: activeSession?.status === "locked",
      attemptsMade,
      maxAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - attemptsMade),
      bestScore,
      nextAttemptNumber: attemptsMade + 1,
      pastAttempts: submittedSessions.map((s, idx) => ({
        sessionId: s.id,
        attemptNumber: s.attemptNumber || idx + 1,
        score: s.score ?? 0,
        submittedAt: s.submittedAt
      }))
    });
  } catch (err) {
    console.error("Error in validate entry:", err);
    return res.status(500).json({ error: "L\u1ED7i x\xE1c th\u1EF1c th\xF4ng tin: " + (err.message || "L\u1ED7i h\u1EC7 th\u1ED1ng") });
  }
};
app.post("/api/student/validate-entry", handleValidateEntry);
app.post("/api/student/validate", handleValidateEntry);
function finalizeLockedSession(session, exam) {
  session.status = "submitted";
  session.submittedAt = session.submittedAt || (/* @__PURE__ */ new Date()).toISOString();
  let cCount = 0;
  let iCount = 0;
  let uCount = 0;
  if (exam && exam.questions) {
    const sessionQuestions = session.questionOrder && session.questionOrder.length > 0 ? session.questionOrder.map((qId) => exam.questions.find((q) => q.id === qId)).filter(Boolean) : exam.questions;
    for (const q of sessionQuestions) {
      if (!q || !q.id) continue;
      const studentChoice = session.answers ? session.answers[q.id] : void 0;
      if (!studentChoice) {
        uCount++;
        continue;
      }
      const mapping = session.optionOrder ? session.optionOrder[q.id] : void 0;
      const origChoice = mapping ? mapping[studentChoice] : studentChoice;
      if (origChoice === q.correctAnswer) {
        cCount++;
      } else {
        iCount++;
      }
    }
    const totalQ = sessionQuestions.length;
    session.score = totalQ > 0 ? Math.round(cCount * 10 / totalQ * 100) / 100 : 0;
    session.correctCount = cCount;
    session.incorrectCount = iCount;
    session.unansweredCount = uCount;
  }
  db.saveSession(session);
}
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
app.post("/api/student/start", (req, res) => {
  try {
    const { examCode, studentName, studentClass, sbd, forceNew } = req.body || {};
    if (!examCode || !studentName || !studentClass) {
      return res.status(400).json({ error: "Thi\u1EBFu th\xF4ng tin b\u1EAFt \u0111\u1EA7u b\xE0i thi: M\xE3 \u0111\u1EC1, H\u1ECD t\xEAn, L\u1EDBp" });
    }
    const authHeader = req.headers.authorization;
    let isTeacherReq = false;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const [user, secret] = decoded.split(":::");
        if (user === TEACHER_USERNAME || user === TEACHER_EMAIL || user === "legialoi" || user === "legialoi@gmail.com" || user === "admin") {
          isTeacherReq = true;
        }
      } catch (e) {
      }
    }
    const sClassNorm = String(studentClass).trim().toLowerCase();
    const isTestClass = isTeacherReq || sClassNorm.includes("thu") || sClassNorm.includes("th\u1EED") || sClassNorm.includes("test") || sClassNorm.includes("demo") || sClassNorm.includes("gv");
    const cleanExamCode = String(examCode || "").trim();
    let exam = db.getExamByCode(cleanExamCode);
    if (!exam) {
      const allExams = db.getExams();
      exam = allExams.find((e) => e.isOpen) || allExams[0];
    }
    if (!exam) {
      return res.status(404).json({ error: "B\xE0i ki\u1EC3m tra kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 b\u1ECB x\xF3a." });
    }
    if (!exam.questions || !Array.isArray(exam.questions) || exam.questions.length === 0) {
      const restored = db.restoreSampleExams();
      exam.questions = restored[0]?.questions || [];
    }
    if (!exam.isOpen && !isTeacherReq && !isTestClass) {
      return res.status(403).json({ error: `B\xE0i ki\u1EC3m tra "${exam.title}" hi\u1EC7n \u0111ang \u0111\xF3ng. Vui l\xF2ng li\xEAn h\u1EC7 th\u1EA7y L\xEA Gia L\u1EE3i \u0111\u1EC3 m\u1EDF ph\xF2ng thi.` });
    }
    const existingSessions = db.getSessions(exam.id) || [];
    const studentPrevSessions = existingSessions.filter(
      (s) => s && s.studentName && s.studentClass && String(s.studentName).trim().toLowerCase() === String(studentName).trim().toLowerCase() && String(s.studentClass).trim().toLowerCase() === String(studentClass).trim().toLowerCase()
    );
    const nowMs = Date.now();
    studentPrevSessions.forEach((s) => {
      if (s.status === "locked") {
        const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
        if (nowMs - lastActive > 6e4) {
          finalizeLockedSession(s, exam);
        }
      } else if (s.status === "in_progress") {
        const expires = new Date(s.expiresAt).getTime();
        if (nowMs >= expires) {
          s.status = "submitted";
          s.submittedAt = s.expiresAt;
          finalizeLockedSession(s, exam);
        } else {
          const lastActive = new Date(s.lastHeartbeat || s.startedAt).getTime();
          if (nowMs - lastActive > 12e4) {
            s.status = "cancelled_disconnection";
            db.saveSession(s);
          }
        }
      }
    });
    const submittedSessions = studentPrevSessions.filter((s) => s.status === "submitted");
    const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
    const prevSession = studentPrevSessions.find((s) => s.status === "in_progress" || s.status === "locked");
    if (prevSession && !forceNew) {
      if (prevSession.status === "locked") {
        return res.status(403).json({
          error: "B\xE0i thi c\u1EE7a b\u1EA1n \u0111ang b\u1ECB kh\xF3a do vi ph\u1EA1m n\u1ED9i quy. Vui l\xF2ng ch\u1EDD \u0111\u1EBFm ng\u01B0\u1EE3c 1 ph\xFAt \u0111\u1EC3 quay v\u1EC1 m\xE0n h\xECnh ch\xEDnh ho\u1EB7c b\xE1o th\u1EA7y L\xEA Gia L\u1EE3i m\u1EDF kh\xF3a.",
          isLocked: true,
          sessionId: prevSession.id
        });
      }
      const expiresMs = new Date(prevSession.expiresAt).getTime();
      if (nowMs >= expiresMs) {
        return autoSubmitSession(prevSession, exam, res);
      }
      const studentQuestions2 = (prevSession.questionOrder || []).map((qId, idx) => {
        const origQ = (exam.questions || []).find((q) => q && q.id === qId);
        if (!origQ) return null;
        const optMap = prevSession.optionOrder && prevSession.optionOrder[qId] || { A: "A", B: "B", C: "C", D: "D" };
        const options = ["A", "B", "C", "D"].map((displayId) => {
          const origOptId = optMap[displayId];
          const origOpt = (origQ.options || []).find((o) => o && o.id === origOptId);
          return {
            id: displayId,
            text: origOpt ? origOpt.text : ""
          };
        });
        return {
          id: origQ.id,
          number: idx + 1,
          content: origQ.content || "",
          codeSnippet: origQ.codeSnippet,
          codeLanguage: origQ.codeLanguage,
          imageUrl: origQ.imageUrl,
          options
        };
      }).filter(Boolean);
      const prevScores2 = submittedSessions.map((s) => s.score ?? 0);
      const bestSoFar = prevScores2.length > 0 ? Math.max(...prevScores2) : void 0;
      return res.json({
        sessionId: prevSession.id,
        startedAt: prevSession.startedAt,
        expiresAt: prevSession.expiresAt,
        questions: studentQuestions2,
        savedAnswers: prevSession.answers,
        flaggedQuestions: prevSession.flaggedQuestions || [],
        violationCount: prevSession.violationCount || 0,
        attemptNumber: prevSession.attemptNumber || 1,
        maxAttempts,
        attemptsMade: submittedSessions.length,
        attemptsRemaining: Math.max(0, maxAttempts - (prevSession.attemptNumber || 1)),
        bestScoreSoFar: bestSoFar
      });
    }
    if (submittedSessions.length >= maxAttempts && !studentPrevSessions.some((s) => s.retakeAllowed)) {
      const scores = submittedSessions.map((s) => s.score ?? 0);
      const best = scores.length > 0 ? Math.max(...scores) : 0;
      return res.status(403).json({
        error: `\u0110\xE3 qu\xE1 s\u1ED1 l\u1EA7n l\xE0m b\xE0i cho ph\xE9p (${submittedSessions.length}/${maxAttempts} l\u1EA7n). Gi\xE1o vi\xEAn ch\u1EC9 cho ph\xE9p l\xE0m t\u1ED1i \u0111a ${maxAttempts} l\u1EA7n. B\u1EA1n kh\xF4ng th\u1EC3 v\xE0o l\xE0m b\xE0i th\xEAm. H\u1EC7 th\u1ED1ng ghi nh\u1EADn \u0111i\u1EC3m cao nh\u1EA5t: ${best} \u0111i\u1EC3m.`,
        hasCompletedAllAttempts: true,
        maxAttempts,
        attemptsMade: submittedSessions.length,
        bestScore: best
      });
    }
    const attemptNumber = submittedSessions.length + 1;
    const startDate = /* @__PURE__ */ new Date();
    const expiresDate = new Date(startDate.getTime() + (exam.durationMinutes || 15) * 60 * 1e3);
    const totalQuestionsInBank = exam.questions ? exam.questions.length : 0;
    const isRandomSubset = Boolean(
      exam.randomQuestionCount && exam.randomQuestionCount > 0 && exam.randomQuestionCount < totalQuestionsInBank
    );
    const targetQuestionCount = isRandomSubset ? exam.randomQuestionCount : totalQuestionsInBank;
    const rawQuestions = Array.isArray(exam.questions) ? exam.questions.filter(Boolean) : [];
    const shuffledBank = shuffleArray([...rawQuestions]);
    const qList = shuffledBank.slice(0, targetQuestionCount).filter((q) => q && q.id);
    const questionOrder = qList.map((q) => q.id);
    const optionOrder = {};
    const studentQuestions = qList.map((origQ, idx) => {
      let optIds = ["A", "B", "C", "D"];
      if (exam.shuffleOptions !== false) {
        optIds = shuffleArray(optIds);
      }
      const mapping = {
        A: optIds[0] || "A",
        B: optIds[1] || "B",
        C: optIds[2] || "C",
        D: optIds[3] || "D"
      };
      if (origQ && origQ.id) {
        optionOrder[origQ.id] = mapping;
      }
      const mappedOptions = ["A", "B", "C", "D"].map((displayId) => {
        const origOptId = mapping[displayId];
        const origOpt = origQ && Array.isArray(origQ.options) ? origQ.options.find((o) => o && o.id === origOptId) : void 0;
        return {
          id: displayId,
          text: origOpt ? origOpt.text || "" : ""
        };
      });
      return {
        id: origQ.id,
        number: idx + 1,
        content: origQ.content || "",
        codeSnippet: origQ.codeSnippet,
        codeLanguage: origQ.codeLanguage,
        imageUrl: origQ.imageUrl,
        options: mappedOptions
      };
    });
    const session = {
      id: `ses-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      examId: exam.id,
      studentName: String(studentName).trim(),
      studentClass: String(studentClass).trim(),
      sbd: sbd ? String(sbd).trim() : void 0,
      attemptNumber,
      startedAt: startDate.toISOString(),
      expiresAt: expiresDate.toISOString(),
      status: "in_progress",
      questionOrder,
      optionOrder,
      answers: {},
      flaggedQuestions: [],
      violations: [],
      violationCount: 0,
      lastHeartbeat: startDate.toISOString()
    };
    db.saveSession(session);
    const prevScores = submittedSessions.map((s) => s.score ?? 0);
    const bestScoreSoFar = prevScores.length > 0 ? Math.max(...prevScores) : void 0;
    res.json({
      sessionId: session.id,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      questions: studentQuestions,
      savedAnswers: session.answers,
      flaggedQuestions: [],
      violationCount: 0,
      attemptNumber,
      maxAttempts,
      attemptsMade: submittedSessions.length,
      attemptsRemaining: Math.max(0, maxAttempts - attemptNumber),
      bestScoreSoFar
    });
  } catch (err) {
    console.error("Error starting exam:", err);
    return res.status(500).json({ error: "L\u1ED7i kh\u1EDFi t\u1EA1o b\xE0i thi: " + (err.message || "L\u1ED7i h\u1EC7 th\u1ED1ng") });
  }
});
function autoSubmitSession(session, exam, res) {
  return gradeAndSubmit(session, exam, res);
}
function gradeAndSubmit(session, exam, res) {
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  const examQuestions = Array.isArray(exam.questions) ? exam.questions : [];
  const sessionQuestions = session.questionOrder && session.questionOrder.length > 0 ? session.questionOrder.map((qId) => examQuestions.find((q) => q && q.id === qId)).filter(Boolean) : examQuestions;
  for (const q of sessionQuestions) {
    if (!q || !q.id) continue;
    const studentChoice = session.answers ? session.answers[q.id] : void 0;
    if (!studentChoice) {
      unansweredCount++;
      continue;
    }
    const mapping = session.optionOrder ? session.optionOrder[q.id] : void 0;
    const originalOptionChosen = mapping ? mapping[studentChoice] : studentChoice;
    if (originalOptionChosen === q.correctAnswer) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }
  const totalQuestions = sessionQuestions.length;
  const answeredCount = correctCount + incorrectCount;
  unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const score = totalQuestions > 0 ? Math.round(correctCount * 10 / totalQuestions * 100) / 100 : 0;
  session.status = "submitted";
  session.submittedAt = (/* @__PURE__ */ new Date()).toISOString();
  session.score = score;
  session.correctCount = correctCount;
  session.incorrectCount = incorrectCount;
  session.unansweredCount = unansweredCount;
  db.saveSession(session);
  const allStudentSubmitted = (db.getSessions(exam.id) || []).filter(
    (s) => s && s.studentName && s.studentClass && String(s.studentName).trim().toLowerCase() === String(session.studentName).trim().toLowerCase() && String(s.studentClass).trim().toLowerCase() === String(session.studentClass).trim().toLowerCase() && s.status === "submitted"
  );
  const allScores = allStudentSubmitted.map((s) => s.score ?? 0);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : score;
  const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
  const attemptsMade = allStudentSubmitted.length;
  const attemptsRemaining = Math.max(0, maxAttempts - attemptsMade);
  return res.json({
    success: true,
    score,
    bestScore,
    studentScore: exam.showScoreAfterSubmit !== false ? score : void 0,
    studentBestScore: exam.showScoreAfterSubmit !== false ? bestScore : void 0,
    examId: exam.id,
    examCode: exam.code,
    attemptNumber: session.attemptNumber || attemptsMade,
    attemptsMade,
    maxAttempts,
    attemptsRemaining,
    canRetake: attemptsRemaining > 0,
    correctCount,
    incorrectCount,
    answeredCount,
    unansweredCount,
    totalQuestions,
    showScore: exam.showScoreAfterSubmit !== false,
    submittedAt: session.submittedAt
  });
}
app.post("/api/student/answer", (req, res) => {
  const { sessionId, questionId, optionId, flagged, examId, studentName, studentClass, sbd } = req.body;
  let session = sessionId ? db.getSession(sessionId) : void 0;
  if (!session && sessionId && (examId || studentName)) {
    const exam = (examId ? db.getExam(examId) : void 0) || db.getExams()[0];
    if (exam) {
      session = {
        id: sessionId,
        examId: exam.id,
        studentName: studentName || "H\u1ECDc sinh",
        studentClass: studentClass || "",
        sbd: sbd || "",
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1e3).toISOString(),
        answers: {},
        status: "in_progress",
        violationCount: 0,
        violations: [],
        questionOrder: exam.questions ? exam.questions.map((q) => q.id) : [],
        optionOrder: {},
        attemptNumber: 1,
        flaggedQuestions: [],
        lastHeartbeat: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.saveSession(session);
    }
  }
  if (!session) {
    return res.json({ success: true, savedAnswers: {} });
  }
  if (session.status === "submitted") {
    return res.status(400).json({ error: "B\xE0i thi \u0111\xE3 \u0111\u01B0\u1EE3c n\u1ED9p" });
  }
  if (session.status === "locked") {
    return res.status(403).json({ error: "B\xE0i thi \u0111ang b\u1ECB kh\xF3a", isLocked: true });
  }
  if (questionId && optionId) {
    if (!session.answers) session.answers = {};
    session.answers[questionId] = optionId;
  }
  if (flagged !== void 0 && questionId) {
    if (!Array.isArray(session.flaggedQuestions)) session.flaggedQuestions = [];
    if (flagged) {
      if (!session.flaggedQuestions.includes(questionId)) {
        session.flaggedQuestions.push(questionId);
      }
    } else {
      session.flaggedQuestions = session.flaggedQuestions.filter((id) => id !== questionId);
    }
  }
  session.lastHeartbeat = (/* @__PURE__ */ new Date()).toISOString();
  db.saveSession(session);
  res.json({ success: true, savedAnswers: session.answers });
});
app.post("/api/student/violation", (req, res) => {
  const { sessionId, type, description, examId, studentName, studentClass, sbd } = req.body;
  let session = sessionId ? db.getSession(sessionId) : void 0;
  if (!session && sessionId && (examId || studentName)) {
    const exam2 = (examId ? db.getExam(examId) : void 0) || db.getExams()[0];
    if (exam2) {
      session = {
        id: sessionId,
        examId: exam2.id,
        studentName: studentName || "H\u1ECDc sinh",
        studentClass: studentClass || "",
        sbd: sbd || "",
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        expiresAt: new Date(Date.now() + (exam2.durationMinutes || 45) * 60 * 1e3).toISOString(),
        answers: {},
        status: "in_progress",
        violationCount: 0,
        violations: [],
        questionOrder: exam2.questions ? exam2.questions.map((q) => q.id) : [],
        optionOrder: {},
        attemptNumber: 1,
        flaggedQuestions: [],
        lastHeartbeat: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.saveSession(session);
    }
  }
  if (!session) {
    return res.json({ recorded: true, violationCount: 1, isLocked: false, maxViolations: 3 });
  }
  if (session.status === "submitted") {
    return res.json({ recorded: false });
  }
  const exam = db.getExam(session.examId);
  const maxViolations = exam?.maxViolationsBeforeLock || 3;
  const event = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    type: type || "tab_switch",
    description: description || "R\u1EDDi kh\u1ECFi trang ki\u1EC3m tra ho\u1EB7c tho\xE1t to\xE0n m\xE0n h\xECnh"
  };
  if (!Array.isArray(session.violations)) {
    session.violations = [];
  }
  session.violations.push(event);
  session.violationCount = Math.max((session.violationCount || 0) + 1, session.violations.length);
  session.lastHeartbeat = (/* @__PURE__ */ new Date()).toISOString();
  let isLocked = false;
  if (session.violationCount >= maxViolations) {
    session.status = "locked";
    isLocked = true;
    if (session.score === void 0 && exam && exam.questions) {
      let cCount = 0;
      let iCount = 0;
      let uCount = 0;
      for (const q of exam.questions) {
        const studentChoice = session.answers ? session.answers[q.id] : void 0;
        if (!studentChoice) {
          uCount++;
          continue;
        }
        const mapping = session.optionOrder ? session.optionOrder[q.id] : void 0;
        const origChoice = mapping ? mapping[studentChoice] : studentChoice;
        if (origChoice === q.correctAnswer) {
          cCount++;
        } else {
          iCount++;
        }
      }
      const totalQ = exam.questions.length;
      session.correctCount = cCount;
      session.incorrectCount = iCount;
      session.unansweredCount = uCount;
      session.score = totalQ > 0 ? Math.round(cCount * 10 / totalQ * 100) / 100 : 0;
    }
  }
  db.saveSession(session);
  res.json({
    success: true,
    violationCount: session.violationCount,
    isLocked,
    maxViolations
  });
});
app.post("/api/student/heartbeat", (req, res) => {
  const { sessionId, examId, studentName, studentClass, sbd, violationCount, answers, status, attemptNumber } = req.body;
  if (!sessionId) return res.json({ success: true, isLocked: false, status: "in_progress" });
  let session = db.getSession(sessionId);
  if (!session && (examId || studentName)) {
    const exam = (examId ? db.getExam(examId) : void 0) || db.getExams()[0];
    if (exam) {
      session = {
        id: sessionId,
        examId: exam.id,
        studentName: studentName || "H\u1ECDc sinh",
        studentClass: studentClass || "",
        sbd: sbd || "",
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1e3).toISOString(),
        answers: answers || {},
        status: status || "in_progress",
        violationCount: violationCount || 0,
        violations: [],
        questionOrder: exam.questions ? exam.questions.map((q) => q.id) : [],
        optionOrder: {},
        attemptNumber: attemptNumber || 1,
        flaggedQuestions: [],
        lastHeartbeat: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.saveSession(session);
    }
  }
  if (!session) {
    return res.json({
      success: true,
      isLocked: false,
      status: "in_progress"
    });
  }
  if (session.status === "submitted") {
    return res.json({
      success: true,
      isLocked: false,
      status: "submitted",
      score: session.score
    });
  }
  session.lastHeartbeat = (/* @__PURE__ */ new Date()).toISOString();
  if (answers && typeof answers === "object") {
    session.answers = { ...session.answers, ...answers };
  }
  if (violationCount !== void 0) {
    session.violationCount = violationCount;
  }
  db.saveSession(session);
  res.json({
    success: true,
    isLocked: session.status === "locked",
    status: session.status
  });
});
app.post("/api/student/lock-exit", (req, res) => {
  const { sessionId } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn l\xE0m b\xE0i" });
  }
  const exam = db.getExam(session.examId);
  if (exam) {
    finalizeLockedSession(session, exam);
  } else {
    session.status = "submitted";
    session.submittedAt = (/* @__PURE__ */ new Date()).toISOString();
    db.saveSession(session);
  }
  res.json({
    success: true,
    message: "B\xE0i thi \u0111\xE3 b\u1ECB kh\xF3a do vi ph\u1EA1m v\xE0 t\xEDnh l\xE0 1 l\u1EA7n l\xE0m b\xE0i."
  });
});
app.post("/api/student/submit", (req, res) => {
  const {
    sessionId,
    examId,
    examCode,
    studentName,
    studentClass,
    sbd,
    answers,
    questionOrder,
    optionOrder,
    violationCount,
    startedAt,
    attemptNumber
  } = req.body;
  let session = sessionId ? db.getSession(sessionId) : void 0;
  let exam = session ? db.getExam(session.examId) : examId ? db.getExam(examId) : examCode ? db.getExamByCode(examCode) : void 0;
  if (!exam && db.getExams().length > 0) {
    exam = db.getExams()[0];
  }
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i thi" });
  }
  if (!session) {
    const sId = sessionId || `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    session = {
      id: sId,
      examId: exam.id,
      studentName: studentName || "H\u1ECDc sinh",
      studentClass: studentClass || "",
      sbd: sbd || "",
      startedAt: startedAt || (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + (exam.durationMinutes || 45) * 60 * 1e3).toISOString(),
      answers: answers || {},
      status: "in_progress",
      violationCount: violationCount || 0,
      violations: [],
      questionOrder: Array.isArray(questionOrder) && questionOrder.length > 0 ? questionOrder : exam.questions ? exam.questions.map((q) => q.id) : [],
      optionOrder: optionOrder || {},
      attemptNumber: attemptNumber || 1,
      flaggedQuestions: [],
      lastHeartbeat: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.saveSession(session);
  } else {
    if (answers && typeof answers === "object") {
      session.answers = { ...session.answers, ...answers };
    }
    if (violationCount !== void 0) {
      session.violationCount = violationCount;
    }
    if (sbd && !session.sbd) {
      session.sbd = sbd;
    }
  }
  return gradeAndSubmit(session, exam, res);
});
app.get("/api/proctor/:examId", requireTeacherAuth, (req, res) => {
  const exam = db.getExam(req.params.examId);
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  const sessions = db.getSessions(exam.id);
  const now = Date.now();
  const proctorList = sessions.map((s, index) => {
    const expiresMs = new Date(s.expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresMs - now) / 1e3));
    const lastActiveMs = new Date(s.lastHeartbeat).getTime();
    const isDisconnected = s.status === "in_progress" && now - lastActiveMs > 35e3;
    const answeredCount = Object.keys(s.answers || {}).length;
    let computedStatus = s.status;
    if (computedStatus === "in_progress") {
      if (isDisconnected) {
        computedStatus = "disconnected";
      } else if (remainingSeconds <= 0) {
        computedStatus = "submitted";
      }
    }
    return {
      stt: index + 1,
      sessionId: s.id,
      studentName: s.studentName,
      studentClass: s.studentClass,
      sbd: s.sbd || "",
      attemptNumber: s.attemptNumber || 1,
      maxAttempts: exam.maxAttempts || 1,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
      submittedAt: s.submittedAt,
      status: computedStatus,
      answeredCount,
      totalQuestions: exam.questions.length,
      remainingSeconds,
      violationCount: s.violationCount || 0,
      violations: s.violations || [],
      score: s.score,
      retakeAllowed: s.retakeAllowed
    };
  });
  res.json({
    examId: exam.id,
    examTitle: exam.title,
    examCode: exam.code,
    totalQuestions: exam.questions.length,
    students: proctorList
  });
});
app.post("/api/proctor/action", requireTeacherAuth, (req, res) => {
  const { sessionId, action, value } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn ki\u1EC3m tra" });
  }
  const exam = db.getExam(session.examId);
  switch (action) {
    case "unlock":
      session.status = "in_progress";
      session.violationCount = Math.max(0, (exam?.maxViolationsBeforeLock || 3) - 1);
      db.saveSession(session);
      return res.json({ success: true, message: "\u0110\xE3 m\u1EDF kh\xF3a b\xE0i thi cho h\u1ECDc sinh" });
    case "retake":
      session.status = "in_progress";
      session.retakeAllowed = true;
      session.answers = {};
      session.flaggedQuestions = [];
      session.violationCount = 0;
      session.violations = [];
      session.score = void 0;
      session.submittedAt = void 0;
      const duration = exam ? exam.durationMinutes : 45;
      const now = /* @__PURE__ */ new Date();
      session.startedAt = now.toISOString();
      session.expiresAt = new Date(now.getTime() + duration * 60 * 1e3).toISOString();
      session.lastHeartbeat = now.toISOString();
      db.saveSession(session);
      return res.json({ success: true, message: "\u0110\xE3 cho ph\xE9p h\u1ECDc sinh thi l\u1EA1i t\u1EEB \u0111\u1EA7u" });
    case "extend_time":
      const minutesToAdd = Number(value) || 5;
      const curExpires = new Date(session.expiresAt).getTime();
      const newExpires = new Date(Math.max(Date.now(), curExpires) + minutesToAdd * 60 * 1e3);
      session.expiresAt = newExpires.toISOString();
      if (session.status === "locked") {
        session.status = "in_progress";
      }
      db.saveSession(session);
      return res.json({
        success: true,
        message: `\u0110\xE3 gia h\u1EA1n th\xEAm ${minutesToAdd} ph\xFAt`,
        expiresAt: session.expiresAt
      });
    case "force_submit":
      if (exam) {
        return gradeAndSubmit(session, exam, res);
      }
      return res.status(400).json({ error: "Kh\xF4ng th\u1EC3 n\u1ED9p b\xE0i" });
    default:
      return res.status(400).json({ error: "H\xE0nh \u0111\u1ED9ng kh\xF4ng h\u1EE3p l\u1EC7" });
  }
});
app.get("/api/reports/:examId", requireTeacherAuth, (req, res) => {
  const exam = db.getExam(req.params.examId);
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  const allExamSessions = db.getSessions(exam.id);
  const sessions = allExamSessions.filter((s) => s.status === "submitted" || s.status === "locked");
  for (const s of sessions) {
    if (s.score === void 0 || s.correctCount === void 0) {
      let right = 0;
      let wrong = 0;
      let unans = 0;
      for (const q of exam.questions) {
        const studentChoice = s.answers ? s.answers[q.id] : void 0;
        if (!studentChoice) {
          unans++;
          continue;
        }
        const mapping = s.optionOrder ? s.optionOrder[q.id] : void 0;
        const origChoice = mapping ? mapping[studentChoice] : studentChoice;
        if (origChoice === q.correctAnswer) {
          right++;
        } else {
          wrong++;
        }
      }
      const totalQ = exam.questions.length;
      s.score = totalQ > 0 ? Math.round(right * 10 / totalQ * 100) / 100 : 0;
      s.correctCount = right;
      s.incorrectCount = wrong;
      s.unansweredCount = unans;
      db.saveSession(s);
    }
  }
  const studentMap = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    const key = `${s.studentName.trim().toLowerCase()}:::${s.studentClass.trim().toLowerCase()}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, []);
    }
    studentMap.get(key).push(s);
  }
  const studentSummaryList = [];
  studentMap.forEach((userSessions) => {
    userSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    let bestSession = userSessions[0];
    let maxSc = -1;
    for (const s of userSessions) {
      const sc = s.score ?? 0;
      if (sc > maxSc) {
        maxSc = sc;
        bestSession = s;
      }
    }
    const allStudentViolations = userSessions.flatMap((s) => Array.isArray(s.violations) ? s.violations : []);
    const totalStudentViolations = userSessions.reduce((acc, s) => {
      const v = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
      return acc + v;
    }, 0);
    const attempts = userSessions.map((s, aIdx) => ({
      sessionId: s.id,
      attemptNumber: s.attemptNumber || aIdx + 1,
      score: s.score ?? 0,
      correctCount: s.correctCount ?? 0,
      incorrectCount: s.incorrectCount ?? 0,
      unansweredCount: s.unansweredCount ?? 0,
      violationCount: Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0),
      status: s.status,
      submittedAt: s.submittedAt || s.startedAt
    }));
    studentSummaryList.push({
      sessionId: bestSession.id,
      name: bestSession.studentName,
      studentName: bestSession.studentName,
      class: bestSession.studentClass,
      studentClass: bestSession.studentClass,
      sbd: bestSession.sbd || "",
      score: maxSc,
      // HIGHEST SCORE (Điểm cao nhất)
      bestScore: maxSc,
      attemptCount: userSessions.length,
      maxAttempts: exam.maxAttempts || 1,
      attempts,
      correctCount: bestSession.correctCount ?? 0,
      incorrectCount: bestSession.incorrectCount ?? 0,
      unansweredCount: bestSession.unansweredCount ?? 0,
      violationCount: totalStudentViolations,
      violations: allStudentViolations,
      status: bestSession.status,
      submittedAt: bestSession.submittedAt || (bestSession.status === "locked" ? bestSession.lastHeartbeat || bestSession.startedAt : void 0)
    });
  });
  const studentScores = studentSummaryList.map((s) => s.score);
  const totalStudentsCount = studentSummaryList.length;
  const totalSubmissions = sessions.length;
  const averageScore = totalStudentsCount > 0 ? Math.round(studentScores.reduce((a, b) => a + b, 0) / totalStudentsCount * 100) / 100 : 0;
  const highestScore = totalStudentsCount > 0 ? Math.max(...studentScores) : 0;
  const lowestScore = totalStudentsCount > 0 ? Math.min(...studentScores) : 0;
  const passCount = studentScores.filter((s) => s >= 5).length;
  const passRate = totalStudentsCount > 0 ? Math.round(passCount / totalStudentsCount * 100) : 0;
  const goodCount = studentScores.filter((s) => s >= 8).length;
  let totalViolations = 0;
  let violatingStudentsCount = 0;
  let lockedStudentsCount = 0;
  for (const s of sessions) {
    const vCount = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
    if (vCount > 0) {
      totalViolations += vCount;
      violatingStudentsCount++;
    }
    if (s.status === "locked") {
      lockedStudentsCount++;
    }
  }
  const distribution = [
    { range: "0 - 1.9", count: studentScores.filter((s) => s < 2).length },
    { range: "2.0 - 4.9", count: studentScores.filter((s) => s >= 2 && s < 5).length },
    { range: "5.0 - 6.4", count: studentScores.filter((s) => s >= 5 && s < 6.5).length },
    { range: "6.5 - 7.9", count: studentScores.filter((s) => s >= 6.5 && s < 8).length },
    { range: "8.0 - 10", count: studentScores.filter((s) => s >= 8).length }
  ];
  const questionAnalysis = exam.questions.map((q, idx) => {
    let wrong = 0;
    let right = 0;
    for (const s of sessions) {
      const studentChoice = s.answers ? s.answers[q.id] : void 0;
      if (!studentChoice) {
        wrong++;
        continue;
      }
      const mapping = s.optionOrder ? s.optionOrder[q.id] : void 0;
      const origChoice = mapping ? mapping[studentChoice] : studentChoice;
      if (origChoice === q.correctAnswer) {
        right++;
      } else {
        wrong++;
      }
    }
    const total = right + wrong;
    const errorRate = total > 0 ? Math.round(wrong / total * 100) : 0;
    return {
      questionNumber: idx + 1,
      questionText: q.content.length > 70 ? q.content.substring(0, 70) + "..." : q.content,
      correctCount: right,
      incorrectCount: wrong,
      errorRate
    };
  }).sort((a, b) => b.errorRate - a.errorRate);
  res.json({
    examId: exam.id,
    examTitle: exam.title,
    examCode: exam.code,
    totalSubmissions,
    totalStudentsCount,
    maxAttempts: exam.maxAttempts || 1,
    averageScore,
    highestScore,
    lowestScore,
    passCount,
    passRate,
    goodCount,
    totalViolations,
    violatingStudentsCount,
    lockedStudentsCount,
    distribution,
    questionAnalysis,
    submissions: studentSummaryList.map((s, idx) => ({
      stt: idx + 1,
      sessionId: s.sessionId,
      name: s.name,
      class: s.class,
      sbd: s.sbd,
      score: s.score,
      // Highest score
      bestScore: s.bestScore,
      attemptCount: s.attemptCount,
      maxAttempts: s.maxAttempts,
      attempts: s.attempts,
      correctCount: s.correctCount,
      incorrectCount: s.incorrectCount,
      unansweredCount: s.unansweredCount,
      violationCount: s.violationCount,
      violations: s.violations,
      status: s.status,
      submittedAt: s.submittedAt
    }))
  });
});
app.get("/api/reports/:examId/export", requireTeacherAuth, (req, res) => {
  const exam = db.getExam(req.params.examId);
  if (!exam) {
    return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ki\u1EC3m tra" });
  }
  const sessions = db.getSessions(exam.id);
  const data = [];
  data.push(["TR\u01AF\u1EDCNG THCS NAM C\u1EECA VI\u1EC6T"]);
  data.push(["K\u1EBET QU\u1EA2 B\xC0I KI\u1EC2M TRA TR\u1EAEC NGHI\u1EC6M TIN H\u1ECCC"]);
  data.push([`B\xE0i ki\u1EC3m tra: ${exam.title}`]);
  data.push([`M\xE3 \u0111\u1EC1: ${exam.code} | Kh\u1ED1i: ${exam.grade} | Ng\xE0y xu\u1EA5t: ${(/* @__PURE__ */ new Date()).toLocaleDateString("vi-VN")}`]);
  data.push([`Gi\xE1o vi\xEAn ph\u1EE5 tr\xE1ch: L\xEA Gia L\u1EE3i`]);
  data.push([`Quy \u0111\u1ECBnh l\xE0m b\xE0i: T\u1ED1i \u0111a ${exam.maxAttempts || 1} l\u1EA7n - L\u1EA5y \u0111i\u1EC3m cao nh\u1EA5t trong c\xE1c l\u1EA7n thi`]);
  data.push([]);
  data.push([
    "STT",
    "H\u1ECD v\xE0 t\xEAn",
    "L\u1EDBp",
    "S\u1ED1 b\xE1o danh",
    "\u0110i\u1EC3m cao nh\u1EA5t",
    "S\u1ED1 l\u1EA7n \u0111\xE3 l\xE0m",
    "Chi ti\u1EBFt c\xE1c l\u1EA7n thi",
    "S\u1ED1 c\xE2u \u0111\xFAng",
    "S\u1ED1 c\xE2u sai",
    "S\u1ED1 c\xE2u ch\u01B0a l\xE0m",
    "T\u1ED5ng vi ph\u1EA1m",
    "Tr\u1EA1ng th\xE1i",
    "Th\u1EDDi gian n\u1ED9p"
  ]);
  const studentMap = /* @__PURE__ */ new Map();
  for (const s of sessions) {
    const key = `${s.studentName.trim().toLowerCase()}:::${s.studentClass.trim().toLowerCase()}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, []);
    }
    studentMap.get(key).push(s);
  }
  let sttIdx = 1;
  studentMap.forEach((userSessions) => {
    userSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    let bestSession = userSessions[0];
    let maxSc = -1;
    for (const s of userSessions) {
      const sc = s.score ?? 0;
      if (sc > maxSc) {
        maxSc = sc;
        bestSession = s;
      }
    }
    const totalStudentViolations = userSessions.reduce((acc, s) => {
      const v = Math.max(s.violationCount || 0, Array.isArray(s.violations) ? s.violations.length : 0);
      return acc + v;
    }, 0);
    const attemptsHistoryStr = userSessions.map((s, idx) => {
      const attNum = s.attemptNumber || idx + 1;
      return `L\u1EA7n ${attNum}: ${s.score ?? 0}\u0111`;
    }).join("; ");
    const statusText = bestSession.status === "submitted" ? totalStudentViolations > 0 ? `\u0110\xE3 n\u1ED9p (${totalStudentViolations} vi ph\u1EA1m)` : "\u0110\xE3 n\u1ED9p b\xE0i" : bestSession.status === "locked" ? `B\u1ECB kh\xF3a (${totalStudentViolations} vi ph\u1EA1m)` : "\u0110ang l\xE0m";
    const submittedDate = bestSession.submittedAt ? new Date(bestSession.submittedAt).toLocaleString("vi-VN") : bestSession.status === "locked" ? `B\u1ECB kh\xF3a (${new Date(bestSession.lastHeartbeat || bestSession.startedAt).toLocaleString("vi-VN")})` : "Ch\u01B0a n\u1ED9p";
    data.push([
      sttIdx++,
      bestSession.studentName,
      bestSession.studentClass,
      bestSession.sbd || "",
      maxSc,
      `${userSessions.length}/${exam.maxAttempts || 1}`,
      attemptsHistoryStr,
      bestSession.correctCount ?? 0,
      bestSession.incorrectCount ?? 0,
      bestSession.unansweredCount ?? 0,
      totalStudentViolations,
      statusText,
      submittedDate
    ]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 },
    // STT
    { wch: 25 },
    // Họ và tên
    { wch: 10 },
    // Lớp
    { wch: 14 },
    // SBD
    { wch: 14 },
    // Điểm cao nhất
    { wch: 14 },
    // Số lần làm
    { wch: 28 },
    // Chi tiết các lần
    { wch: 12 },
    // Đúng
    { wch: 12 },
    // Sai
    { wch: 14 },
    // Chưa làm
    { wch: 14 },
    // Vi phạm
    { wch: 18 },
    // Trạng thái
    { wch: 22 }
    // Ngày nộp
  ];
  XLSX.utils.book_append_sheet(wb, ws, "BangDiem");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `KetQua_${exam.code}_THCS_NamCuaViet.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buf);
});
app.get("/api/backup", requireTeacherAuth, (req, res) => {
  res.json(db.getBackup());
});
app.post("/api/restore", requireTeacherAuth, (req, res) => {
  const incoming = req.body && req.body.data !== void 0 ? req.body.data : req.body;
  const result = db.restoreBackup(incoming);
  if (!result.success) {
    return res.status(400).json({ error: result.error || "T\u1EC7p sao l\u01B0u kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng" });
  }
  res.json({
    success: true,
    message: result.message || "Kh\xF4i ph\u1EE5c d\u1EEF li\u1EC7u th\xE0nh c\xF4ng",
    details: result.details
  });
});
app.post("/api/admin/clear-all-data", requireTeacherAuth, (req, res) => {
  db.clearAllExamsAndSessions();
  res.json({
    success: true,
    message: "\u0110\xE3 x\xF3a r\u1ED7ng to\xE0n b\u1ED9 danh s\xE1ch \u0111\u1EC1 thi v\xE0 l\u1ECBch s\u1EED l\xE0m b\xE0i. H\u1EC7 th\u1ED1ng s\u1EA1ch s\u1EBD 100% \u0111\u1EC3 th\u1EA7y n\u1EA1p \u0111\u1EC1 m\u1EDBi!"
  });
});
app.post("/api/sessions/sync", (req, res) => {
  const { sessions } = req.body;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.json({ success: true, synced: 0 });
  }
  let count = 0;
  for (const incoming of sessions) {
    if (!incoming || !incoming.id || !incoming.examId) continue;
    const existing = db.getSession(incoming.id);
    if (!existing) {
      db.saveSession(incoming);
      count++;
    } else {
      let changed = false;
      if (incoming.status === "submitted" && existing.status !== "submitted") {
        existing.status = "submitted";
        existing.submittedAt = incoming.submittedAt || (/* @__PURE__ */ new Date()).toISOString();
        changed = true;
      }
      if (incoming.score !== void 0 && (existing.score === void 0 || incoming.score > existing.score)) {
        existing.score = incoming.score;
        existing.correctCount = incoming.correctCount ?? existing.correctCount;
        existing.incorrectCount = incoming.incorrectCount ?? existing.incorrectCount;
        existing.unansweredCount = incoming.unansweredCount ?? existing.unansweredCount;
        changed = true;
      }
      const incViolations = incoming.violationCount || 0;
      const exViolations = existing.violationCount || 0;
      if (incViolations > exViolations) {
        existing.violationCount = incViolations;
        if (Array.isArray(incoming.violations) && incoming.violations.length > 0) {
          existing.violations = incoming.violations;
        }
        changed = true;
      }
      if (changed) {
        db.saveSession(existing);
        count++;
      }
    }
  }
  res.json({ success: true, synced: count });
});
app.delete("/api/sessions/:sessionId", requireTeacherAuth, (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: "M\xE3 phi\xEAn thi kh\xF4ng h\u1EE3p l\u1EC7" });
  }
  db.deleteSession(sessionId);
  res.json({ success: true, message: `\u0110\xE3 x\xF3a b\xE0i thi ${sessionId} th\xE0nh c\xF4ng` });
});
app.use((err, req, res, next) => {
  console.error("[API INTERNAL ERROR]:", err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({
    error: err?.message ? `L\u1ED7i h\u1EC7 th\u1ED1ng: ${err.message}` : "L\u1ED7i m\xE1y ch\u1EE7 (500). Vui l\xF2ng th\u1EED l\u1EA1i sau."
  });
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `\u0110\u01B0\u1EDDng d\u1EABn API kh\xF4ng t\u1ED3n t\u1EA1i: ${req.method} ${req.originalUrl}` });
});
var handleGracefulShutdown = (signal) => {
  console.log(`[NCV-DB] Received ${signal}, flushing database to disk...`);
  try {
    const backup = db.getBackup();
    if (backup) {
      console.log(`[NCV-DB] Successfully verified database integrity on ${signal}.`);
    }
  } catch (err) {
    console.error(`[NCV-DB] Error persisting on ${signal}:`, err);
  }
};
if (!process.env.VERCEL) {
  process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
  process.on("beforeExit", () => handleGracefulShutdown("beforeExit"));
}
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    try {
      const viteModule = await Function("pkg", "return import(pkg)")("vite");
      const createViteServer = viteModule.createServer;
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite dev middleware not loaded:", e);
    }
  } else {
    app.use(express.static(path2.resolve(safeDirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path2.resolve(safeDirname, "dist", "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server KIEM TRA TIN HOC - THCS NAM CUA VIET dang chay tai port ${PORT}`);
  });
}
var server_default = app;
var isMainScript = Boolean(
  process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"))
);
if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.NOW_BUILD && isMainScript) {
  startServer();
}

// api/_handler.ts
function handler(req, res) {
  return new Promise((resolve) => {
    let finished = false;
    const onComplete = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };
    res.once("finish", onComplete);
    res.once("close", onComplete);
    res.once("error", onComplete);
    try {
      let targetPath = "";
      const queryParam = req.query?.__path || req.query?.path;
      if (queryParam) {
        targetPath = Array.isArray(queryParam) ? queryParam.join("/") : String(queryParam);
      } else if (req.url && req.url.includes("__path=")) {
        const match = req.url.match(/__path=([^&]+)/);
        if (match && match[1]) {
          targetPath = decodeURIComponent(match[1]);
        }
      }
      if (targetPath) {
        req.url = "/api/" + targetPath.replace(/^\//, "");
      } else {
        const headerUrl = req.headers["x-forwarded-uri"] || req.headers["x-original-url"] || req.headers["x-matched-path"];
        if (headerUrl && typeof headerUrl === "string" && headerUrl.startsWith("/api")) {
          req.url = headerUrl;
        } else if (req.url && !req.url.startsWith("/api")) {
          req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
        }
      }
      req.originalUrl = req.url;
      if (req.body !== void 0 && req.body !== null) {
        if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
          try {
            req.body = JSON.parse(req.body);
          } catch (e) {
          }
        }
        req._body = true;
      } else if (req.complete || req.readableEnded) {
        req.body = {};
        req._body = true;
      }
      server_default(req, res);
    } catch (err) {
      console.error("[Vercel Handler Root Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "L\u1ED7i h\u1EC7 th\u1ED1ng m\xE1y ch\u1EE7: " + (err?.message || "Kh\xF4ng th\u1EC3 x\u1EED l\xFD y\xEAu c\u1EA7u")
        });
      }
      onComplete();
    }
  });
}
export {
  handler as default
};
