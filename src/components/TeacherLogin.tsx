import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  AlertCircle,
  RotateCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  LogIn
} from 'lucide-react';
import { api } from '../services/api';

interface TeacherLoginProps {
  onLoginSuccess: (user: any) => void;
  onCancel: () => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password / Email recovery states
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ tài khoản và mật khẩu giáo viên');
      return;
    }
    setIsLoading(true);

    try {
      const res = await api.login(username.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPasswordToEmail = async () => {
    setRecoveryNotice(null);
    setIsSendingEmail(true);
    try {
      const res = await api.sendTeacherPasswordToEmail();
      setRecoveryNotice({
        type: res.success ? 'success' : 'info',
        text: res.message,
      });
    } catch (err: any) {
      setRecoveryNotice({
        type: 'error',
        text: err.message || 'Không thể gửi email lúc này, vui lòng thử lại.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleVerifyGoogleOwner = async () => {
    setRecoveryNotice(null);
    setIsVerifyingGoogle(true);
    try {
      const res = await api.verifyTeacherGoogleAndGetPassword();
      if (!res.verified) {
        setRecoveryNotice({
          type: 'error',
          text: res.error || 'Xác thực tài khoản Google legialoi@gmail.com không thành công.',
        });
        return;
      }
      setVerifiedEmail(res.email);
      if (res.currentPassword) {
        setRevealedPassword(res.currentPassword);
        setRecoveryNotice({
          type: 'success',
          text: 'Đã xác thực chính chủ legialoi@gmail.com! Mật khẩu hiện có của thầy được hiển thị bên dưới.',
        });
      } else {
        setRecoveryNotice({
          type: 'success',
          text: 'Đã xác thực chính chủ legialoi@gmail.com! Thầy có thể đặt mật khẩu mới hoặc vào thẳng Bàn làm việc.',
        });
      }
    } catch (err: any) {
      setRecoveryNotice({
        type: 'error',
        text: err.message || 'Lỗi xác thực Google.',
      });
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  const handleDirectLoginOrResetAfterGoogle = async (withNewPassword: boolean) => {
    if (!verifiedEmail) return;
    if (withNewPassword && newResetPassword.trim().length < 6) {
      setRecoveryNotice({
        type: 'error',
        text: 'Mật khẩu mới phải có ít nhất 6 ký tự!',
      });
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.resetTeacherPasswordByGoogleVerified(
        verifiedEmail,
        withNewPassword ? newResetPassword.trim() : undefined
      );
      onLoginSuccess(res.user);
    } catch (err: any) {
      setRecoveryNotice({
        type: 'error',
        text: err.message || 'Không thể đăng nhập lúc này.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            {isForgotMode ? <Mail className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isForgotMode ? 'Khôi phục Mật khẩu Giáo viên' : 'Đăng nhập Giáo viên'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Hệ thống kiểm tra Tin học • THCS Nam Cửa Việt
          </p>
        </div>

        {!isForgotMode ? (
          <>
            {errorMsg && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tài khoản Giáo viên
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="legialoi"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-sm font-medium outline-none transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mật khẩu Admin
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setErrorMsg(null);
                      setRecoveryNotice(null);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của thầy"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 text-sm font-medium outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2 text-[11px] text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Khu vực bảo mật dành riêng cho Giáo viên phụ trách phòng Tin học</span>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Đang đăng nhập...</span>
                    </>
                  ) : (
                    <span>Đăng nhập</span>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 text-indigo-800">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Hộp thư nhận mật khẩu mặc định:</span>
              </div>
              <div className="font-mono font-bold text-sm text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 select-all">
                legialoi@gmail.com
              </div>
              <p className="text-[11px] text-slate-600 pt-0.5">
                Mật khẩu hiện có chỉ được gửi duy nhất về địa chỉ Gmail chính chủ của Thầy Lê Gia Lợi.
              </p>
            </div>

            {recoveryNotice && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-start space-x-2 border ${
                  recoveryNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : recoveryNotice.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {recoveryNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{recoveryNotice.text}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSendPasswordToEmail}
              disabled={isSendingEmail}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-200 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isSendingEmail ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Đang gửi mật khẩu về legialoi@gmail.com...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Gửi mật khẩu hiện có về mail legialoi@gmail.com</span>
                </>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200"></div>
              <span className="shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase">
                Hoặc xem ngay không cần chờ mail
              </span>
              <div className="grow border-t border-slate-200"></div>
            </div>

            {!verifiedEmail ? (
              <button
                type="button"
                onClick={handleVerifyGoogleOwner}
                disabled={isVerifyingGoogle}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isVerifyingGoogle ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Đang xác thực Gmail legialoi@gmail.com...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Xác thực Gmail legialoi@gmail.com (Xem mật khẩu ngay)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-3">
                {revealedPassword && (
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800 uppercase mb-1">
                      Mật khẩu Giáo viên hiện có của thầy:
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 font-mono font-bold text-sm bg-white px-3 py-2 rounded-lg border border-emerald-300 text-slate-900 select-all">
                        {revealedPassword}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(revealedPassword);
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPass ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Đặt mật khẩu mới (nếu muốn đổi luôn):
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (>= 6 ký tự)"
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={isLoading || newResetPassword.trim().length < 6}
                      onClick={() => handleDirectLoginOrResetAfterGoogle(true)}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      Lưu & Vào
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleDirectLoginOrResetAfterGoogle(false)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Vào thẳng Bàn làm việc Giáo viên</span>
                </button>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(false);
                  setRecoveryNotice(null);
                }}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer py-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại đăng nhập</span>
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

