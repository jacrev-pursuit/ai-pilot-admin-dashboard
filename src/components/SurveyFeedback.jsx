import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Row, Col, Typography, DatePicker, Select, Spin, Alert, Tag, Table, Segmented } from 'antd';
import dayjs from 'dayjs';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';
import { fetchSurveyResponses, fetchWeeklyNpsByCohort } from '../services/surveyService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ChartTitle, Tooltip, Legend);

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const npsToColor = (nps) => {
  if (nps === null || nps === undefined) return '#808080';
  if (nps >= 50) return '#38761d';
  if (nps >= 0) return '#bf9002';
  return '#990000';
};

const SurveyFeedback = () => {
  const [dateRange, setDateRange] = useState([dayjs('2025-09-01'), dayjs()]);
  const [cohorts, setCohorts] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState(undefined);

  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [respLoading, setRespLoading] = useState(false);
  const [themesLoading, setThemesLoading] = useState(false);

  const [responses, setResponses] = useState([]);
  const [themes, setThemes] = useState([]);
  const [weeklyByCohort, setWeeklyByCohort] = useState([]);
  const [weeklyByCohortCalendar, setWeeklyByCohortCalendar] = useState([]); // For summary table 'this week'
  // Removed cohortAllTime; compute from weekly data
  const [weekMode, setWeekMode] = useState('calendar'); // 'program' | 'calendar'

  const [error, setError] = useState(null);

  useEffect(() => {
    const loadCohorts = async () => {
      try {
        const res = await fetch('/api/cohorts');
        if (!res.ok) throw new Error('cohorts fetch failed');
        const list = await res.json();
        setCohorts(list);
      } catch (e) {
        // Non-fatal
      }
    };
    loadCohorts();
  }, []);

  // Fetch responses and cohort summaries (independent of week toggle)
  useEffect(() => {
    if (!dateRange || dateRange.length !== 2) return;
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    setError(null);

    const load = async () => {
      setRespLoading(true);
      try {
        const [r, wbCal] = await Promise.all([
          fetchSurveyResponses(startDate, endDate, selectedCohort, undefined),
          fetchWeeklyNpsByCohort(startDate, endDate, selectedCohort, 'calendar') // respect cohort filter
        ]);
        setResponses(r || []);
        setWeeklyByCohortCalendar(wbCal || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setRespLoading(false);
      }
    };
    load();
  }, [dateRange, selectedCohort]);

  // Fetch weekly-by-cohort for the chart only (respects toggle)
  useEffect(() => {
    if (!dateRange || dateRange.length !== 2) return;
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    const loadWeekly = async () => {
      setWeeklyLoading(true);
      try {
        const wb = await fetchWeeklyNpsByCohort(startDate, endDate, selectedCohort, weekMode);
        setWeeklyByCohort(wb || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setWeeklyLoading(false);
      }
    };
    loadWeekly();
  }, [dateRange, selectedCohort, weekMode]);

  const weeksRawRef = useRef([]);
  const countsMapRef = useRef(new Map());
  const programWeekMapRef = useRef(new Map());

  const weeklyChart = useMemo(() => {
    const cohorts = Array.from(new Set((weeklyByCohort || []).map(r => r.cohort || 'Unknown')));
    const weeks = weekMode === 'calendar'
      ? Array.from(new Set((weeklyByCohort || []).map(r => (r.week_start?.value || r.week_start)))).sort()
      : Array.from(new Set((weeklyByCohort || []).map(r => r.program_week))).sort((a,b)=>a-b);
    const colorPalette = ['#4f7bb8','#7fbf7f','#bf7fbf','#ffb347','#66c2a5','#fc8d62','#8da0cb','#e78ac3'];
    weeksRawRef.current = weeks.slice();
    const tmpCounts = new Map();
    const datasets = cohorts.map((cohort, idx) => {
      const rows = (weeklyByCohort||[]).filter(r => (r.cohort||'Unknown')===cohort);
      const pointsByWeek = new Map(rows.map(r => {
        const key = weekMode==='calendar' ? (r.week_start?.value || r.week_start) : r.program_week;
        const count = Number(r.total_responses)||0;
        tmpCounts.set(`${cohort}::${String(key)}`, count);
        // Track program week per cohort/key for tooltip display
        programWeekMapRef.current.set(`${cohort}::${String(key)}`, r.program_week);
        return [key, r.nps];
      }));
      return {
        label: cohort,
        data: weeks.map(wk => pointsByWeek.get(wk) ?? null),
        borderColor: colorPalette[idx % colorPalette.length],
        backgroundColor: 'transparent',
        spanGaps: true
      };
    });
    countsMapRef.current = tmpCounts;
    const labels = weekMode==='calendar'
      ? weeks.map(d => {
          const start = dayjs(d);
          const end = start.add(4, 'day');
          return `${start.format('MMM D')} - ${end.format('MMM D')}`;
        })
      : weeks.map(w => `Week ${w}`);
    return { labels, datasets };
  }, [weeklyByCohort, weekMode]);

  const weeklyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, title: { display: true, text: 'NPS' } } },
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: weekMode==='calendar' ? 'Weekly NPS by Cohort (Calendar Weeks Sat–Wed)' : 'Weekly NPS by Cohort (Program Weeks)' },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (ctx) => {
            const cohort = ctx.dataset?.label || '';
            const rawKey = weeksRawRef.current[ctx.dataIndex];
            const count = countsMapRef.current.get(`${cohort}::${String(rawKey)}`) || 0;
            const nps = ctx.parsed?.y;
            const lines = [];
            lines.push(`${cohort}`);
            lines.push(`NPS: ${nps != null ? nps.toFixed(0) : '—'}`);
            lines.push(`Responses: ${count}`);
            return lines;
          }
        }
      }
    }
  };

  // Build Cohort Summary Table data: Cohort, NPS this week (calendar), NPS all time
  const cohortSummaryData = useMemo(() => {
    // Determine "this week" as the latest calendar week present in data
    const weekStarts = Array.from(new Set((weeklyByCohortCalendar||[]).map(r => r.week_start?.value || r.week_start).filter(Boolean))).sort();
    const latestWeekStart = weekStarts.length ? weekStarts[weekStarts.length - 1] : null;
    const latestWeekStr = latestWeekStart ? dayjs(latestWeekStart).format('YYYY-MM-DD') : null;

    const thisWeekMap = new Map();
    if (latestWeekStr) {
      (weeklyByCohortCalendar||[]).forEach(r => {
        const wk = (r.week_start?.value || r.week_start);
        if (wk && dayjs(wk).format('YYYY-MM-DD') === latestWeekStr) {
          const cohort = r.cohort || 'Unknown';
          thisWeekMap.set(cohort, r.nps);
        }
      });
    }
    // Compute all-time NPS per cohort by aggregating weekly counts
    const totalsMap = new Map(); // cohort -> {total, promoters, detractors}
    (weeklyByCohortCalendar||[]).forEach(r => {
      const cohort = r.cohort || 'Unknown';
      const agg = totalsMap.get(cohort) || { total: 0, promoters: 0, detractors: 0 };
      agg.total += Number(r.total_responses) || 0;
      agg.promoters += Number(r.promoters) || 0;
      agg.detractors += Number(r.detractors) || 0;
      totalsMap.set(cohort, agg);
    });

    let cohortsList = Array.from(new Set((weeklyByCohortCalendar||[]).map(r => r.cohort || 'Unknown'))).sort();
    if (selectedCohort) cohortsList = cohortsList.filter(c => c === selectedCohort);

    return cohortsList.map(c => {
      const agg = totalsMap.get(c) || { total: 0, promoters: 0, detractors: 0 };
      const npsAll = agg.total > 0 ? ((agg.promoters - agg.detractors) / agg.total) * 100 : null;
      return { cohort: c, npsThisWeek: thisWeekMap.get(c) ?? null, npsAllTime: npsAll };
    });
  }, [weeklyByCohortCalendar, selectedCohort, dateRange]);

  const dateFilters = useMemo(() => {
    const uniq = Array.from(new Set((responses||[]).map(r => r.task_date ? dayjs(r.task_date?.value || r.task_date).format('YYYY-MM-DD') : null).filter(Boolean)));
    return uniq.sort().map(d => ({ text: dayjs(d).format('MMM D, YYYY'), value: d }));
  }, [responses]);
  const userFilters = useMemo(() => {
    const uniq = Array.from(new Set((responses||[]).map(r => r.user_name).filter(Boolean)));
    return uniq.sort().map(u => ({ text: u, value: u }));
  }, [responses]);
  const cohortFilters = useMemo(() => {
    const uniq = Array.from(new Set((responses||[]).map(r => r.cohort || 'Unknown').filter(Boolean)));
    return uniq.sort().map(c => ({ text: c, value: c }));
  }, [responses]);
  const weekFilters = useMemo(() => {
    const uniq = Array.from(new Set((responses||[]).map(r => r.program_week).filter(Boolean)));
    return uniq.sort((a,b)=>a-b).map(w => ({ text: `Week ${w}`, value: w }));
  }, [responses]);
  const npsFilters = [
    { text: 'Promoters (9-10)', value: 'promoter' },
    { text: 'Passives (7-8)', value: 'passive' },
    { text: 'Detractors (0-6)', value: 'detractor' }
  ];
  const columns = [
    { title: 'Date', dataIndex: 'task_date', key: 'task_date', render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : '-', sorter: (a,b)=>dayjs(a.task_date?.value||a.task_date).unix()-dayjs(b.task_date?.value||b.task_date).unix(), filters: dateFilters, onFilter: (val, rec)=> dayjs(rec.task_date?.value||rec.task_date).format('YYYY-MM-DD')===val },
    { title: 'User', dataIndex: 'user_name', key: 'user_name', sorter: (a,b)=> (a.user_name||'').localeCompare(b.user_name||''), filters: userFilters, onFilter: (val, rec)=> (rec.user_name||'')===val },
    { title: 'Cohort', dataIndex: 'cohort', key: 'cohort', sorter: (a,b)=> (a.cohort||'').localeCompare(b.cohort||''), filters: cohortFilters, onFilter: (val, rec)=> (rec.cohort||'Unknown')===val },
    { title: 'NPS', dataIndex: 'referral_likelihood', key: 'referral_likelihood', sorter: (a,b)=> (a.referral_likelihood||0)-(b.referral_likelihood||0), filters: npsFilters, onFilter: (val, rec)=> val==='promoter'? rec.referral_likelihood>=9 : val==='passive'? (rec.referral_likelihood>=7 && rec.referral_likelihood<=8) : rec.referral_likelihood<=6, render: (v) => <Tag color={v>=9?'green':v<=6?'red':'gold'}>{v}</Tag> },
    { title: 'What went well', dataIndex: 'what_we_did_well', key: 'what_we_did_well' },
    { title: 'What to improve', dataIndex: 'what_to_improve', key: 'what_to_improve' }
  ];

  // Removed KPI calculations (referenced variables may cause errors)

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Title level={2} style={{ margin: 0 }}>Survey Feedback</Title>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Select
            placeholder="Cohort"
            value={selectedCohort}
            onChange={setSelectedCohort}
            allowClear
            style={{ minWidth: 240 }}
          >
            {cohorts.map(c => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
          <RangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {error && <Alert type="error" message="Error loading survey data" description={error} showIcon style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Weekly NPS" style={{ borderRadius: 8 }} extra={
            <Segmented size="small" value={weekMode} onChange={setWeekMode} options={[
              { label: 'Program', value: 'program' },
              { label: 'Calendar', value: 'calendar' }
            ]} />
          }>
            {weeklyLoading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div> : (
              <div style={{ height: 280 }}>
                <Line data={weeklyChart} options={weeklyOptions} />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Cohort NPS Summary" style={{ borderRadius: 8 }}>
            <Table
              columns={[
                { title: 'Cohort', dataIndex: 'cohort', key: 'cohort' },
                { title: 'NPS This Week', dataIndex: 'npsThisWeek', key: 'npsThisWeek', render: v => (v==null||v===undefined)? '—' : Number.isFinite(Number(v))? Number(v).toFixed(0) : '—' },
                { title: 'NPS All Time', dataIndex: 'npsAllTime', key: 'npsAllTime', render: v => (v==null||v===undefined)? '—' : Number.isFinite(Number(v))? Number(v).toFixed(0) : '—' }
              ]}
              dataSource={cohortSummaryData}
              rowKey={(r)=>r.cohort}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="Responses" style={{ borderRadius: 8 }}>
            {respLoading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div> : (
              <Table
                columns={columns}
                dataSource={responses}
                rowKey={(r) => r.id}
                pagination={{ pageSize: 10 }}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SurveyFeedback;


