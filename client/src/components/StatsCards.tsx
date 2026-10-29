import React from 'react';
import { EmailItem } from '../types';
import { Clock, CheckCircle2, AlertTriangle, Send } from 'lucide-react';

interface StatsCardsProps {
  emails: EmailItem[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ emails }) => {
  const scheduledCount = emails.filter((e) => e.status === 'SCHEDULED').length;
  const sentCount = emails.filter((e) => e.status === 'SENT').length;
  const processingCount = emails.filter((e) => e.status === 'PROCESSING').length;
  const failedCount = emails.filter((e) => e.status === 'FAILED').length;

  const stats = [
    {
      title: 'Scheduled Emails',
      value: scheduledCount,
      description: 'Pending in BullMQ Redis queue',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Successfully Sent',
      value: sentCount,
      description: 'Delivered via Ethereal SMTP',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'In Processing',
      value: processingCount,
      description: 'Worker active dispatching',
      icon: Send,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
    },
    {
      title: 'Failed / Rescheduled',
      value: failedCount,
      description: 'Rate limited or error retry',
      icon: AlertTriangle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.description}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor} ${stat.color} border ${stat.borderColor}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
