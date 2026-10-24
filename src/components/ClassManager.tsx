import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Save,
  School,
  Check,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Upload,
  UserCheck,
  RotateCw,
  Sparkles,
  RotateCcw,
  Key,
  KeyRound,
  Copy,
  Download,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ClassInfo, GradeLevel, StudentInfo } from '../types';
import { api } from '../services/api';

interface ClassManagerProps {
  onClassesUpdated?: (classes: ClassInfo[]) => void;
}

export const ClassManager: React.FC<ClassManagerProps> = ({ onClassesUpdated }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<GradeLevel>(8);
  const [isLoading, setIsLoading] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reset password & batch action confirmation states (In-app Modals, no window.confirm!)
  const [classToResetPass, setClassToResetPass] = useState<string | null>(null);
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);
  const [justResetStudentId, setJustResetStudentId] = useState<string | null>(null);
  const [showClearRosterConfirm, setShowClearRosterConfirm] = useState(false);
  const [showGenerateAllConfirm, setShowGenerateAllConfirm] = useState(false);

  // Student roster modal state
  const [selectedClassForRoster, setSelectedClassForRoster] = useState<string | null>(null);
  const [rosterStudents, setRosterStudents] = useState<StudentInfo[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterTab, setRosterTab] = useState<'list' | 'quick_import'>('list');

  // Quick import text
  const [quickImportText, setQuickImportText] = useState('');
  const [isSavingRoster, setIsSavingRoster] = useState(false);

  // Single student add
  const [singleName, setSingleName] = useState('');
  const [singleSbd, setSingleSbd] = useState('');

  // Student counts map
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadClasses();
    loadAllStudentCounts();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const loadClasses = async () => {
    try {
      const res = await api.getClasses();
      setClasses(res);
      if (onClassesUpdated) {
        onClassesUpdated(res);
      }
      await loadAllStudentCounts(res);
    } catch (err: any) {
      console.error('Failed to load classes:', err);
      showFeedback('error', 'Không thể tải danh sách lớp');
    }
  };

  const loadAllStudentCounts = async (classList?: ClassInfo[]) => {
    try {
      const allStudents = await api.getStudents();
      const targetClasses = classList || classes;
      const counts: Record<string, number> = {};
      targetClasses.forEach((c) => {
        if (c && c.name) {
          counts[c.name.trim().toUpperCase()] = 0;
        }
      });
      allStudents.forEach((s) => {
        if (!s || !s.class) return;
        const clsKey = s.class.trim().toUpperCase();
        counts[clsKey] = (counts[clsKey] || 0) + 1;
      });
      setClassStudentCounts(counts);
    } catch (err) {
      console.error('Failed to load student counts:', err);
    }
  };

  const handleOpenRoster = async (className: string) => {
    setSelectedClassForRoster(className);
    setRosterTab('list');
    setQuickImportText('');
    setSingleName('');
    setSingleSbd('');
    setIsLoadingRoster(true);
    try {
      const students = await api.getStudents(className);
      setRosterStudents(students);
      const upperCls = className.trim().toUpperCase();
      setClassStudentCounts((prev) => ({
        ...prev,
        [upperCls]: students.length,
        [className]: students.length,
      }));
    } catch (err: any) {
      showFeedback('error', 'Lỗi tải danh sách học sinh: ' + err.message);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleCloseRosterModal = () => {
    setSelectedClassForRoster(null);
    loadAllStudentCounts();
  };

  const handleManualSaveRoster = async () => {
    if (!selectedClassForRoster) return;
    setIsSavingRoster(true);
    try {
      await api.saveClassStudents(selectedClassForRoster, rosterStudents);
      const upperCls = selectedClassForRoster.trim().toUpperCase();
      setClassStudentCounts((prev) => ({
        ...prev,
        [upperCls]: rosterStudents.length,
        [selectedClassForRoster]: rosterStudents.length,
      }));
      showFeedback('success', `Đã lưu thành công ${rosterStudents.length} học sinh của lớp ${selectedClassForRoster}`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi lưu: ' + err.message);
    } finally {
      setIsSavingRoster(false);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const trimmed = newClassName.trim().toUpperCase();
    if (classes.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showFeedback('error', `Lớp ${trimmed} đã tồn tại trong danh sách`);
      return;
    }

    const updated = [...classes, { name: trimmed, grade: newClassGrade, studentCount: 0 }];
    setIsLoading(true);
    try {
      await api.saveClasses(updated);
      setClasses(updated);
      if (onClassesUpdated) onClassesUpdated(updated);
      setNewClassName('');
      showFeedback('success', `Đã thêm lớp ${trimmed} thành công`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi lưu lớp: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    const name = classToDelete;
    setClassToDelete(null);

    setIsLoading(true);
    try {
      const res = await api.deleteClass(name);
      const updated = res.classes || classes.filter((c) => c.name !== name);
      setClasses(updated);
      if (onClassesUpdated) onClassesUpdated(updated);
      setClassStudentCounts((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      if (selectedClassForRoster === name) {
        setSelectedClassForRoster(null);
      }
      showFeedback('success', `Đã xóa lớp ${name} thành công`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi xóa lớp: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreDefaultClasses = async () => {
    setIsLoading(true);
    try {
      const res = await api.restoreDefaultClasses();
      setClasses(res.classes);
      if (onClassesUpdated) onClassesUpdated(res.classes);
      await loadAllStudentCounts();
      showFeedback('success', 'Đã khôi phục danh sách các lớp chuẩn khối 6, 7, 8, 9 của THCS Nam Cửa Việt');
    } catch (err: any) {
      showFeedback('error', 'Lỗi khôi phục: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Add single student in modal
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForRoster || !singleName.trim()) return;

    const newStudent: StudentInfo = {
      id: `st-${selectedClassForRoster}-${Date.now()}`,
      name: singleName.trim(),
      sbd: singleSbd.trim() || `${selectedClassForRoster}-${(rosterStudents.length + 1).toString().padStart(2, '0')}`,
      class: selectedClassForRoster,
    };

    const updated = [...rosterStudents, newStudent];
    setRosterStudents(updated);
    setSingleName('');
    setSingleSbd('');

    try {
      await api.saveClassStudents(selectedClassForRoster, updated);
      const upperCls = selectedClassForRoster.trim().toUpperCase();
      setClassStudentCounts((prev) => ({ ...prev, [upperCls]: updated.length, [selectedClassForRoster]: updated.length }));
      showFeedback('success', `Đã thêm học sinh ${newStudent.name}`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi lưu học sinh: ' + err.message);
    }
  };

  // Delete student in modal
  const handleDeleteStudent = async (studentId: string) => {
    if (!selectedClassForRoster) return;
    try {
      await api.deleteStudent(studentId);
      const updated = rosterStudents.filter((s) => s.id !== studentId);
      setRosterStudents(updated);
      const upperCls = selectedClassForRoster.trim().toUpperCase();
      setClassStudentCounts((prev) => ({ ...prev, [upperCls]: updated.length, [selectedClassForRoster]: updated.length }));
      showFeedback('success', 'Đã xóa học sinh khỏi lớp');
    } catch (err: any) {
      showFeedback('error', 'Lỗi xóa học sinh: ' + err.message);
    }
  };

  // Clear all students in modal
  const handleClearRoster = () => {
    if (!selectedClassForRoster) return;
    setShowClearRosterConfirm(true);
  };

  const confirmClearRoster = async () => {
    if (!selectedClassForRoster) return;
    try {
      await api.clearClassStudents(selectedClassForRoster);
      setRosterStudents([]);
      const upperCls = selectedClassForRoster.trim().toUpperCase();
      setClassStudentCounts((prev) => ({ ...prev, [upperCls]: 0, [selectedClassForRoster]: 0 }));
      showFeedback('success', `Đã làm trống danh sách lớp ${selectedClassForRoster}`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi xóa danh sách: ' + err.message);
    } finally {
      setShowClearRosterConfirm(false);
    }
  };

  // Quick populate 15 sample students
  const handlePopulateSampleStudents = async () => {
    if (!selectedClassForRoster) return;
    const sampleNames = [
      'Nguyễn Văn An', 'Trần Thị Bích', 'Lê Hoàng Cường', 'Phạm Minh Dũng',
      'Hoàng Thu Giang', 'Vũ Đức Hải', 'Đỗ Khánh Linh', 'Bùi Quang Minh',
      'Ngô Phương Nam', 'Đinh Yến Nhi', 'Lý Quốc Thái', 'Võ Thanh Trúc',
      'Phan Hải Đăng', 'Trương Mai Phương', 'Nguyễn Gia Huy'
    ];

    const generated: StudentInfo[] = sampleNames.map((name, idx) => ({
      id: `st-${selectedClassForRoster}-${Date.now()}-${idx + 1}`,
      name,
      sbd: `${selectedClassForRoster}-${(idx + 1).toString().padStart(2, '0')}`,
      class: selectedClassForRoster,
    }));

    setIsSavingRoster(true);
    try {
      await api.saveClassStudents(selectedClassForRoster, generated);
      setRosterStudents(generated);
      const upperCls = selectedClassForRoster.trim().toUpperCase();
      setClassStudentCounts((prev) => ({ ...prev, [upperCls]: generated.length, [selectedClassForRoster]: generated.length }));
      showFeedback('success', `Đã nạp ${generated.length} học sinh mẫu cho lớp ${selectedClassForRoster}`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi lưu: ' + err.message);
    } finally {
      setIsSavingRoster(false);
    }
  };

  // Generate username & password for all students in class
  const handleGenerateClassAccounts = async () => {
    if (!selectedClassForRoster) return;
    setIsLoadingRoster(true);
    try {
      const res = await api.generateClassAccounts(selectedClassForRoster);
      if (res.students) {
        setRosterStudents(res.students);
      }
      showFeedback('success', res.message || `Đã tạo Username (2 chữ cuối tên + lớp) & MK mặc định (${selectedClassForRoster}123) cho cả lớp!`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi tạo tài khoản: ' + err.message);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  // Card-level: Generate accounts for a class
  const handleGenerateAccountsForCard = async (className: string) => {
    setIsLoading(true);
    try {
      const res = await api.generateClassAccounts(className);
      showFeedback('success', res.message || `Đã tạo Name & MK mặc định (${className}123) cho toàn bộ học sinh lớp ${className}!`);
      await loadAllStudentCounts();
    } catch (err: any) {
      showFeedback('error', 'Lỗi tạo tài khoản: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Card-level: Trigger Reset passwords modal for a class
  const handleResetPasswordsForCard = (className: string) => {
    setClassToResetPass(className);
  };

  // All-school: Trigger Generate accounts for ALL classes
  const handleGenerateAllSchoolAccounts = () => {
    setShowGenerateAllConfirm(true);
  };

  const confirmGenerateAllSchoolAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await api.generateClassAccounts(undefined, true);
      showFeedback('success', res.message || 'Đã tạo tài khoản cho toàn bộ học sinh các lớp!');
      await loadAllStudentCounts();
    } catch (err: any) {
      showFeedback('error', 'Lỗi tạo tài khoản: ' + err.message);
    } finally {
      setIsLoading(false);
      setShowGenerateAllConfirm(false);
    }
  };

  // Roster-level: Trigger Reset all passwords in class to default
  const handleResetClassPasswords = () => {
    if (!selectedClassForRoster) return;
    setClassToResetPass(selectedClassForRoster);
  };

  // Execute resetting all passwords for a class
  const executeResetClassPasswords = async (className: string) => {
    setIsResettingPass(true);
    const defaultPass = `${className.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
    try {
      const res = await api.resetStudentPassword({ className, resetAll: true });
      if (selectedClassForRoster && selectedClassForRoster.toLowerCase() === className.toLowerCase()) {
        if (res.students && res.students.length > 0) {
          setRosterStudents(res.students);
        } else {
          // If server returned partial, reload or update local state
          const refreshed = await api.getStudents(className, true);
          if (refreshed && refreshed.length > 0) {
            setRosterStudents(refreshed);
          } else {
            setRosterStudents((prev) =>
              prev.map((s) => ({
                ...s,
                password: defaultPass,
                isPasswordChanged: false,
              }))
            );
          }
        }
      }
      showFeedback('success', res.message || `Đã cấp lại mật khẩu mặc định (${defaultPass}) cho toàn bộ học sinh lớp ${className}!`);
      setClassToResetPass(null);
    } catch (err: any) {
      showFeedback('error', 'Lỗi cấp lại mật khẩu: ' + err.message);
    } finally {
      setIsResettingPass(false);
    }
  };

  // Reset single student password with instant feedback and visual indicator
  const handleResetSinglePassword = async (student: StudentInfo) => {
    setResettingStudentId(student.id);
    const defaultPass = `${(student.class || selectedClassForRoster || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
    try {
      const res = await api.resetStudentPassword({ studentId: student.id });
      const updatedStudent: StudentInfo = res.student ? {
        ...res.student,
        password: defaultPass,
        isPasswordChanged: false,
      } : {
        ...student,
        password: defaultPass,
        isPasswordChanged: false,
      };
      setRosterStudents((prev) => prev.map((s) => (s.id === student.id ? updatedStudent : s)));
      setJustResetStudentId(student.id);
      setTimeout(() => {
        setJustResetStudentId(null);
      }, 3500);
      showFeedback('success', `Đã cấp lại mật khẩu mặc định (${defaultPass}) cho học sinh ${student.name}!`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi cấp lại mật khẩu: ' + err.message);
    } finally {
      setResettingStudentId(null);
    }
  };

  // Export accounts to Excel
  const handleExportAccountsExcel = () => {
    if (!selectedClassForRoster || rosterStudents.length === 0) return;
    const defaultPass = `${selectedClassForRoster.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
    const data: any[][] = [];
    data.push(['TRƯỜNG THCS NAM CỬA VIỆT']);
    data.push([`DANH SÁCH TÀI KHOẢN & MẬT KHẨU HỌC SINH — LỚP ${selectedClassForRoster}`]);
    data.push([`Giáo viên phụ trách: Lê Gia Lợi | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
    data.push([`Quy tắc: Tên đăng nhập gồm 2 chữ cuối tên + lớp. Mật khẩu mặc định là: ${defaultPass}.`]);
    data.push([]);
    data.push(['STT', 'Họ và tên', 'Lớp', 'SBD', 'Tên đăng nhập (Username)', 'Mật khẩu', 'Trạng thái mật khẩu']);

    rosterStudents.forEach((st, idx) => {
      data.push([
        idx + 1,
        st.name,
        st.class,
        st.sbd || `${selectedClassForRoster}-${(idx + 1).toString().padStart(2, '0')}`,
        st.username || '',
        st.password || defaultPass,
        st.isPasswordChanged ? 'Đã đổi mật khẩu riêng' : 'Mật khẩu mặc định'
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 26 },
      { wch: 10 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, `TaiKhoan_${selectedClassForRoster}`);
    XLSX.writeFile(wb, `TaiKhoan_Lop_${selectedClassForRoster}_THCS_NamCuaViet.xlsx`);
  };

  // Process Quick Import (Paste from Excel or Word)
  const handleProcessQuickImport = async () => {
    if (!selectedClassForRoster || !quickImportText.trim()) return;

    setIsSavingRoster(true);
    try {
      const lines = quickImportText.split('\n').map((l) => l.trim()).filter(Boolean);
      const imported: StudentInfo[] = lines.map((line, idx) => {
        let sbd = '';
        let name = line;

        if (line.includes('\t')) {
          const parts = line.split('\t').map((p) => p.trim());
          if (parts.length >= 2) {
            sbd = parts[0];
            name = parts.slice(1).join(' ');
          }
        } else if (line.includes(',')) {
          const parts = line.split(',').map((p) => p.trim());
          if (parts.length >= 2) {
            sbd = parts[0];
            name = parts.slice(1).join(' ');
          }
        } else if (line.includes('.')) {
          const firstDot = line.indexOf('.');
          const prefix = line.slice(0, firstDot).trim();
          if (!isNaN(Number(prefix))) {
            sbd = prefix.padStart(2, '0');
            name = line.slice(firstDot + 1).trim();
          }
        }

        if (!sbd) {
          sbd = `${selectedClassForRoster}-${(idx + 1).toString().padStart(2, '0')}`;
        }

        return {
          id: `st-${selectedClassForRoster}-${Date.now()}-${idx + 1}`,
          name: name.trim(),
          sbd: sbd.trim(),
          class: selectedClassForRoster,
        };
      });

      if (imported.length === 0) {
        showFeedback('error', 'Không tìm thấy dòng học sinh nào để nhập');
        return;
      }

      await api.saveClassStudents(selectedClassForRoster, imported);
      setRosterStudents(imported);
      const upperCls = selectedClassForRoster.trim().toUpperCase();
      setClassStudentCounts((prev) => ({ ...prev, [upperCls]: imported.length, [selectedClassForRoster]: imported.length }));
      setRosterTab('list');
      setQuickImportText('');
      showFeedback('success', `Đã nhập thành công ${imported.length} học sinh vào lớp ${selectedClassForRoster}`);
    } catch (err: any) {
      showFeedback('error', 'Lỗi nhập danh sách: ' + err.message);
    } finally {
      setIsSavingRoster(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Top Banner with Quick Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <School className="w-5 h-5 text-indigo-600" />
            <span>Quản lý danh sách lớp học (Khối 6, 7, 8, 9)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Giáo viên nạp danh sách học sinh theo từng lớp. Khi vào thi, học sinh chỉ cần chọn tên từ danh sách menu để làm bài!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateAllSchoolAccounts}
            disabled={isLoading}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-sm shadow-indigo-200"
            title="Tự động tạo Name (2 chữ cuối tên + lớp) & MK mặc định ([TênLớp]123) cho toàn bộ học sinh của tất cả các lớp"
          >
            <Key className="w-3.5 h-3.5 text-amber-300" />
            <span>Tạo Name & MK cho TẤT CẢ các lớp</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreDefaultClasses}
            disabled={isLoading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 border border-slate-200"
            title="Khôi phục các lớp 6A, 6B, 7A, 7B, 8A, 8B, 9A, 9B"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Khôi phục các lớp mặc định (6A-9B)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Add New Class */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center space-x-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Thêm lớp mới</span>
          </h3>

          <form onSubmit={handleAddClass} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Tên lớp <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Ví dụ: 8A, 8B, 9A8..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold uppercase outline-none focus:bg-white focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Tự động viết hoa (VD: 8A, 9B, 9A8)
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Khối
              </label>
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(Number(e.target.value) as GradeLevel)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              >
                <option value={6}>Khối 6</option>
                <option value={7}>Khối 7</option>
                <option value={8}>Khối 8</option>
                <option value={9}>Khối 9</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition cursor-pointer disabled:opacity-50"
            >
              Thêm vào danh sách
            </button>
          </form>
        </div>

        {/* Classes List by Grade */}
        <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Danh sách lớp hiện có ({classes.length} lớp)
            </h3>
            <span className="text-xs text-slate-400">
              Quy tắc: Name = 2 chữ cuối họ tên + lớp • MK mặc định = [TênLớp]123
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([6, 7, 8, 9] as const).map((grade) => {
              const gradeClasses = classes.filter((c) => c.grade === grade);
              return (
                <div key={grade} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                    <span className="font-bold text-xs uppercase text-indigo-700">
                      Khối {grade}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {gradeClasses.length} lớp
                    </span>
                  </div>

                  <div className="flex flex-col space-y-2.5">
                    {gradeClasses.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Chưa có lớp nào</span>
                    ) : (
                      gradeClasses.map((c) => {
                        const studentCount = classStudentCounts[c.name.trim().toUpperCase()] ?? 0;
                        return (
                          <div
                            key={c.name}
                            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 shadow-2xs group transition flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-sm text-slate-900">
                                  Lớp {c.name}
                                </span>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                    studentCount > 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {studentCount > 0 ? `${studentCount} HS` : 'Chưa có DS'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                MK: <b className="text-indigo-700">{c.name}123</b>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleGenerateAccountsForCard(c.name)}
                                disabled={isLoading}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                                title={`Tự động tạo Name (2 chữ cuối tên + lớp) & MK mặc định (${c.name}123) cho toàn bộ học sinh lớp ${c.name}`}
                              >
                                <Key className="w-3 h-3 text-indigo-600" />
                                <span>Tạo Name & MK</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResetPasswordsForCard(c.name)}
                                disabled={isLoading}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                                title={`Cấp lại mật khẩu mặc định (${c.name}123) cho toàn bộ học sinh lớp ${c.name}`}
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>Cấp lại MK</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenRoster(c.name)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer"
                                title="Xem danh sách, sửa, xóa học sinh"
                              >
                                <Users className="w-3 h-3" />
                                <span>DS Học sinh</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setClassToDelete(c.name)}
                                className="px-1.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer ml-auto"
                                title={`Xóa lớp ${c.name}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Student Roster Modal (Xem & Nhập danh sách học sinh) */}
      {selectedClassForRoster && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs">
                  {selectedClassForRoster}
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Danh sách học sinh — Lớp {selectedClassForRoster}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Hiện có {rosterStudents.length} học sinh (Học sinh sẽ thấy menu chọn tên khi vào thi)
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const clsName = selectedClassForRoster;
                    setSelectedClassForRoster(null);
                    setClassToDelete(clsName);
                  }}
                  className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 border border-red-700/60 rounded-lg text-xs font-semibold cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa lớp này</span>
                </button>
                <button
                  onClick={handleCloseRosterModal}
                  className="text-slate-400 hover:text-white p-1.5 cursor-pointer rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50 text-xs font-bold justify-between items-center">
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => setRosterTab('list')}
                  className={`py-2.5 px-4 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                    rosterTab === 'list'
                      ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Danh sách học sinh ({rosterStudents.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRosterTab('quick_import')}
                  className={`py-2.5 px-4 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                    rosterTab === 'quick_import'
                      ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Dán nhanh từ Excel / Word</span>
                </button>
              </div>

              {rosterStudents.length === 0 && (
                <button
                  type="button"
                  onClick={handlePopulateSampleStudents}
                  className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Nạp nhanh 15 HS mẫu</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 text-xs">
              {rosterTab === 'list' && (
                <div className="space-y-5">
                  {/* Form add single student */}
                  <form
                    onSubmit={handleAddSingleStudent}
                    className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-2"
                  >
                    <span className="font-bold text-indigo-900 shrink-0">Thêm từng HS:</span>
                    <input
                      type="text"
                      required
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      placeholder="Họ và tên học sinh"
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs flex-1 min-w-[140px] outline-none"
                    />
                    <input
                      type="text"
                      value={singleSbd}
                      onChange={(e) => setSingleSbd(e.target.value)}
                      placeholder="SBD (VD: 01)"
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-28 outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition cursor-pointer flex items-center space-x-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  </form>

                  {/* List */}
                  {isLoadingRoster ? (
                    <div className="py-8 text-center text-slate-400">
                      <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Đang tải danh sách học sinh...</span>
                    </div>
                  ) : rosterStudents.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50 p-4">
                      <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 mb-1">
                        Lớp {selectedClassForRoster} chưa có danh sách học sinh
                      </p>
                      <p className="text-slate-400 text-[11px] mb-4">
                        Quý thầy có thể dán nhanh danh sách từ Excel hoặc bấm nút nạp 15 học sinh mẫu bên dưới:
                      </p>
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRosterTab('quick_import')}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                        >
                          Dán từ Excel / Word
                        </button>
                        <button
                          type="button"
                          onClick={handlePopulateSampleStudents}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                        >
                          Nạp nhanh 15 học sinh mẫu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Batch Account Actions Bar */}
                      <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 border border-indigo-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 text-sm">
                            Tổng số: <span className="text-indigo-600">{rosterStudents.length}</span> học sinh
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-500">
                            MK mặc định: <b className="font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">{selectedClassForRoster}123</b>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleGenerateClassAccounts}
                            disabled={isLoadingRoster}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                            title="Tự động tạo Username (2 chữ cuối tên + lớp) và Mật khẩu mặc định ([TênLớp]123) cho toàn bộ học sinh lớp"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-300" />
                            <span>Tạo Name & MK cả lớp</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleResetClassPasswords}
                            disabled={isLoadingRoster || isResettingPass}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                            title={`Cấp lại toàn bộ mật khẩu học sinh lớp về mặc định (${selectedClassForRoster}123)`}
                          >
                            {isResettingPass && classToResetPass === selectedClassForRoster ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="w-3.5 h-3.5" />
                            )}
                            <span>Cấp lại MK cả lớp</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleExportAccountsExcel}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                            title="Xuất bảng tài khoản & mật khẩu học sinh ra file Excel"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Xuất Excel</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleManualSaveRoster}
                            disabled={isSavingRoster}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs disabled:opacity-50"
                            title={`Lưu vĩnh viễn danh sách lớp ${selectedClassForRoster}`}
                          >
                            {isSavingRoster ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>Lưu danh sách</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleClearRoster}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                            title="Làm trống toàn bộ danh sách lớp"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Làm trống</span>
                          </button>
                        </div>
                      </div>

                      {/* Account rules explanation banner */}
                      <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-950 flex items-start space-x-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p>
                            <b>Quy tắc tài khoản:</b> Tên đăng nhập (Name) gồm <b>2 chữ cuối của họ tên + lớp</b> (VD: <i>Nguyễn Văn An</i> lớp <i>{selectedClassForRoster}</i> → <code>vanan{selectedClassForRoster.toLowerCase()}</code>).
                          </p>
                          <p className="text-indigo-800">
                            <b>Mật khẩu mặc định:</b> Tên lớp thêm 123 (VD: <code>{selectedClassForRoster}123</code>). Học sinh phải đăng nhập mới vào thi. Khi vào xong trước khi bấm thi, học sinh có thể <b>tự đổi mật khẩu riêng</b> để tránh bị bạn khác dùng chung.
                          </p>
                        </div>
                      </div>

                      {/* Student Account Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">STT</th>
                              <th className="py-2.5 px-3">Họ và tên</th>
                              <th className="py-2.5 px-3 w-20 text-center">SBD</th>
                              <th className="py-2.5 px-3 text-indigo-700 font-bold">Tên đăng nhập (Name)</th>
                              <th className="py-2.5 px-3">Mật khẩu</th>
                              <th className="py-2.5 px-3 text-center">Trạng thái MK</th>
                              <th className="py-2.5 px-3 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {rosterStudents.map((st, idx) => {
                              const defaultPass = `${(st.class || selectedClassForRoster || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123`;
                              const currentPass = st.password || defaultPass;
                              const isJustReset = justResetStudentId === st.id;
                              const isResetting = resettingStudentId === st.id;
                              return (
                                <tr
                                  key={st.id}
                                  className={`transition-colors duration-200 ${
                                    isJustReset
                                      ? 'bg-emerald-50/80 ring-1 ring-emerald-300'
                                      : 'hover:bg-slate-50/80'
                                  }`}
                                >
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900">
                                    {st.name}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                    {st.sbd || `${selectedClassForRoster}-${(idx + 1).toString().padStart(2, '0')}`}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center space-x-1">
                                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                        {st.username || 'Chưa tạo'}
                                      </span>
                                      {st.username && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(st.username || '');
                                            showFeedback('success', `Đã sao chép Username: ${st.username}`);
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                          title="Sao chép tên đăng nhập"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center space-x-1.5">
                                      <span
                                        className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${
                                          isJustReset
                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                                            : 'bg-slate-50 font-semibold text-slate-800 border-slate-200'
                                        }`}
                                      >
                                        {st.isPasswordChanged ? '••••••••' : currentPass}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(currentPass);
                                          showFeedback('success', `Đã sao chép mật khẩu: ${currentPass}`);
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                        title="Sao chép mật khẩu"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {isJustReset ? (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                                        Vừa cấp lại
                                      </span>
                                    ) : st.isPasswordChanged ? (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        Đã đổi MK riêng
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        Mặc định
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleResetSinglePassword(st)}
                                        disabled={isResetting}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 ${
                                          isJustReset
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-300'
                                            : 'bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 border border-amber-200'
                                        }`}
                                        title={`Cấp lại mật khẩu mặc định (${defaultPass}) cho học sinh này`}
                                      >
                                        {isResetting ? (
                                          <RotateCw className="w-3 h-3 text-amber-600 animate-spin" />
                                        ) : isJustReset ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <KeyRound className="w-3 h-3 text-amber-600" />
                                        )}
                                        <span>{isJustReset ? 'Đã cấp lại!' : 'Cấp lại MK'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStudent(st.id)}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                                        title="Xóa học sinh này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {rosterTab === 'quick_import' && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-800 uppercase mb-1">
                      Dán danh sách học sinh từ Excel hoặc Word
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Mỗi học sinh trên 1 dòng. Có thể dán chỉ họ tên (ví dụ: <code>Nguyễn Văn An</code>) hoặc kèm SBD (ví dụ: <code>01, Nguyễn Văn An</code> hoặc <code>01 [tab] Nguyễn Văn An</code>).
                    </p>
                    <textarea
                      rows={10}
                      value={quickImportText}
                      onChange={(e) => setQuickImportText(e.target.value)}
                      placeholder={`1. Nguyễn Văn An\n2. Trần Thị Bích\n3. Lê Hoàng Cường\n4. Phạm Minh Dũng\n5. Hoàng Thu Giang`}
                      className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-500">
                      Số dòng phát hiện:{' '}
                      <b>{quickImportText.split('\n').filter((l) => l.trim()).length}</b> học sinh
                    </span>

                    <button
                      type="button"
                      onClick={handleProcessQuickImport}
                      disabled={isSavingRoster || !quickImportText.trim()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingRoster ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>LƯU DANH SÁCH LỚP {selectedClassForRoster}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mọi thay đổi được tự động lưu vĩnh viễn trên hệ thống</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleManualSaveRoster}
                  disabled={isSavingRoster}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
                  title={`Lưu danh sách học sinh lớp ${selectedClassForRoster}`}
                >
                  {isSavingRoster ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu danh sách lớp</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseRosterModal}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Class Deletion */}
      {classToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Xác nhận xóa lớp {classToDelete}?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa lớp <span className="font-bold text-slate-800">{classToDelete}</span> và toàn bộ học sinh của lớp này khỏi hệ thống trường THCS Nam Cửa Việt?
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteClass}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-red-200 disabled:opacity-50"
              >
                {isLoading ? 'Đang xóa...' : 'Xóa ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Passwords for Class */}
      {classToResetPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Cấp lại Mật khẩu mặc định — Lớp {classToResetPass}
            </h3>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Mật khẩu của <b>toàn bộ học sinh lớp {classToResetPass}</b> sẽ được đưa về mật khẩu mặc định là:{' '}
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {classToResetPass.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}123
              </span>
            </p>
            <p className="text-[11px] text-slate-500 mb-6 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left">
              💡 <b>Lưu ý:</b> Các em học sinh đã tự đổi mật khẩu riêng cũng sẽ được đưa về mật khẩu mặc định này để giáo viên dễ quản lý và cho các em vào làm bài thi.
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setClassToResetPass(null)}
                disabled={isResettingPass}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => executeResetClassPasswords(classToResetPass)}
                disabled={isResettingPass}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-amber-200 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isResettingPass ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang cấp lại...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Đồng ý Cấp lại MK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Roster */}
      {showClearRosterConfirm && selectedClassForRoster && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Làm trống lớp {selectedClassForRoster}?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa toàn bộ danh sách học sinh của lớp <span className="font-bold text-slate-800">{selectedClassForRoster}</span>?
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowClearRosterConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmClearRoster}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-red-200"
              >
                Xóa toàn bộ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Generate All School Accounts */}
      {showGenerateAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-3">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Tạo Name & MK cho toàn trường?
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Hệ thống sẽ tự động tạo tên đăng nhập (2 chữ cuối họ tên + tên lớp) và cấp mật khẩu mặc định (<code>[TênLớp]123</code>) cho <b>toàn bộ học sinh của tất cả các lớp</b>.
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowGenerateAllConfirm(false)}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmGenerateAllSchoolAccounts}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tạo...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đồng ý tạo cho cả trường</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
