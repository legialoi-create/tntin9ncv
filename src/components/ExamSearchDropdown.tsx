import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, BookOpen, X, Filter } from 'lucide-react';
import { Exam, GradeLevel } from '../types';

interface ExamSearchDropdownProps {
  exams: Exam[];
  currentExamId: string;
  onSelectExam: (examId: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  label?: string;
}

export const ExamSearchDropdown: React.FC<ExamSearchDropdownProps> = ({
  exams,
  currentExamId,
  onSelectExam,
  className = '',
  size = 'md',
  align = 'left',
  label = 'Kỳ thi:'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<'ALL' | GradeLevel>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentExam =
    exams.find((e) => e.id === currentExamId) ||
    exams[0];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setSelectedGrade('ALL');
    }
  }, [isOpen]);

  // Filter exams based on search query and grade
  const filteredExams = exams.filter((exam) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      exam.title.toLowerCase().includes(q) ||
      exam.code.toLowerCase().includes(q) ||
      `khối ${exam.grade}`.includes(q) ||
      `khoi ${exam.grade}`.includes(q) ||
      (exam.targetClasses && exam.targetClasses.some((c) => c.toLowerCase().includes(q)));

    const matchGrade = selectedGrade === 'ALL' || exam.grade === selectedGrade;

    return matchSearch && matchGrade;
  });

  const getGradeBadgeColor = (grade: number) => {
    switch (grade) {
      case 6:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 7:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 8:
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 9:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="flex items-center space-x-1.5">
        {label && (
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline whitespace-nowrap">
            {label}
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between space-x-2 bg-white hover:bg-slate-50 border border-slate-300 hover:border-indigo-400 rounded-xl transition shadow-2xs cursor-pointer text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
            size === 'sm' ? 'px-2.5 py-1.5 text-xs max-w-[260px] sm:max-w-xs' : 'px-3 py-2 text-xs sm:text-sm max-w-[280px] sm:max-w-md'
          }`}
          title={currentExam ? `[${currentExam.code}] ${currentExam.title}` : 'Chọn kì thi'}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
            {currentExam ? (
              <>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getGradeBadgeColor(
                    currentExam.grade
                  )}`}
                >
                  K{currentExam.grade}
                </span>
                <span className="font-bold text-slate-900 truncate">
                  <span className="text-indigo-600 font-mono text-[11px] mr-1">
                    [{currentExam.code}]
                  </span>
                  {currentExam.title}
                </span>
              </>
            ) : (
              <span className="text-slate-400 font-medium truncate">-- Chọn kì thi --</span>
            )}
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-80 sm:w-96 max-w-[95vw] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Header & Search Input Box */}
          <div className="p-3 bg-slate-50 border-b border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>MENU CHỌN KỲ THI ({exams.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ô tìm kiếm kì thi */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên kì thi, mã đề, khối, lớp..."
                className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Grade Filter Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto text-[11px] pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedGrade('ALL')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                  selectedGrade === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                Tất cả ({exams.length})
              </button>
              {[6, 7, 8, 9].map((g) => {
                const count = exams.filter((e) => e.grade === g).length;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrade(g as GradeLevel)}
                    className={`px-2 py-0.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                      selectedGrade === g
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                    }`}
                  >
                    Khối {g} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Exams */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredExams.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-slate-400">
                <Search className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                Không tìm thấy kì thi nào phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredExams.map((exam) => {
                const isSelected = exam.id === currentExamId;
                return (
                  <button
                    key={exam.id}
                    type="button"
                    onClick={() => {
                      onSelectExam(exam.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-start space-x-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 border border-indigo-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block ${getGradeBadgeColor(
                          exam.grade
                        )}`}
                      >
                        K{exam.grade}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[11px] font-extrabold text-indigo-700">
                          [{exam.code}]
                        </span>
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {exam.title}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                        <span>{exam.questions?.length || 0} câu hỏi</span>
                        <span>•</span>
                        <span>{exam.durationMinutes} phút</span>
                        {exam.targetClasses && exam.targetClasses.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium truncate max-w-[150px]">
                              Lớp: {exam.targetClasses.join(', ')}
                            </span>
                          </>
                        )}
                        {exam.id === 'exam-1791604725287' && (
                          <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-bold text-[10px] inline-flex items-center space-x-1">
                            <span>9 HS đã nộp</span>
                            <span>⭐</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-1 shrink-0 text-emerald-600">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Info Footer */}
          <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Bấm vào kì thi để xem báo cáo & điểm số</span>
            <span className="font-semibold text-slate-500">{filteredExams.length} kì thi</span>
          </div>
        </div>
      )}
    </div>
  );
};
