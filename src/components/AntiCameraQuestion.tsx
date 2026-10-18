import React from 'react';

interface AntiCameraQuestionProps {
  question?: any;
  onAnswer?: (answer: any) => void;
  selectedAnswer?: string;
  [key: string]: any;
}

export const AntiCameraQuestion: React.FC<AntiCameraQuestionProps> = () => {
  return null;
};

export default AntiCameraQuestion;
