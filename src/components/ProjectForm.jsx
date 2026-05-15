import { useState, useEffect } from 'react';
import axios from 'axios';

const DEFAULT_LEAD_OFFICES = ['Chennai', 'East', 'HQ', 'Hyderabad', 'North', 'West'];
const DEFAULT_SERVICES = ['ESG', 'Green', 'TPC'];
const DEFAULT_RATING_SYSTEMS = [
  'IGBC', 'LEED', 'GRIHA', 'WELL', 'EDGE', 'FITWELL', 'WiredScore', 'GreenPro', 'ILFI'
];
const RATING_SYSTEM_VERSIONS = {
  'LEED': ['v3', 'v4', 'v4.1'],
  'GRIHA': ['v1', 'v2.0', 'v3.0'],
  'IGBC': ['v1.0', 'v2.0', 'v3.0'],
  'WELL': ['v1', 'v2'],
  'EDGE': ['v1.0', 'v2.0'],
  'FITWELL': ['v1.0'],
  'WiredScore': ['v1.0'],
  'GreenPro': ['v1.0'],
  'ILFI': ['v4', 'v4.1']
};
const DEFAULT_CERTIFICATION_TYPES = [
  'BD+C', 'CI', 'CS', 'EB', 'EBOM', 'DC', 'ARC', 'Campus', 'Township',
  'Existing Building', 'Re-certification', 'Design Support', 'Compliance'
];
const DEFAULT_ADDITIONAL_SERVICES = [
  'ESG', 'GHG Accounting', 'Sustainability', 'ECBC', 'ECSBC',
  'LCA', 'EPD', 'Energy Audit', 'Water Audit', 'IAQ',
  'Waste Management', 'Due Diligence', 'CFD', 'Acoustic',
  'Envelope Commissioning', 'Performance Testing', 'Daylight Analysis',
  'Sunpath Analysis'
];
const DEFAULT_BUILDING_USAGES = [
  'Commercial', 'Commercial Office', 'Office', 'Corporate', 'IT Building', 'IT Park', 'Retail', 'Mall', 'Mixed Use',
  'Residential', 'Residential Villas', 'Township', 'Hostel', 'Service Apartment',
  'Educational', 'University', 'School', 'Training Centre', 'Laboratory',
  'Factory', 'Industrial Park', 'Warehouse', 'Logistics Park', 'Refinery',
  'Healthcare', 'Hospital',
  'Hotel', 'Resort', 'Airport', 'Metro', 'Railway', 'Temple',
  'Data Center', 'Testing Center', 'Campus'
];
const DEFAULT_CLIENT_SECTORS = ['Architect', 'Banking', 'Developer', 'Hospital', 'Industrial', 'PMC'];

const mergeUnique = (defaults, dynamic) => {
  const set = new Set(defaults.map(d => d.toLowerCase()));
  const result = [...defaults];
  (dynamic || []).forEach(d => {
    if (d && !set.has(d.toLowerCase())) {
      result.push(d);
      set.add(d.toLowerCase());
    }
  });
  return result;
};

const toInputDate = (d) => {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
};

export default function ProjectForm({ project, onSave, onCancel }) {
  const [form, setForm] = useState({
    projectId: '', projectName: '', vertical: 'ESG', clientName: '',
    leadOffice: 'HQ', services: [], ratingSystem: [], ratingSystemVersions: {},
    certificationType: [], additionalServices: [],
    buildingUsage: '', clientSector: '', projectArea: '', projectLocation: '',
    proposalMonth: '', totalProposedMoney: '', currency: 'INR',
    contactPoint: { name: '', designation: '', number: '', mailId: '' },
    servicesOther: '', ratingSystemOther: '', certificationTypeOther: '',
    additionalServicesOther: '', ratingSystemVersionsOther: '',
    buildingUsageOther: '', clientSectorOther: ''
  });

  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    axios.get('/api/projects/metadata/all').then(res => setMetadata(res.data)).catch(() => {});
  }, []);

  const LEAD_OFFICES = mergeUnique(DEFAULT_LEAD_OFFICES, metadata?.leadOffices);
  const SERVICES = mergeUnique(DEFAULT_SERVICES, metadata?.services);
  const RATING_SYSTEMS = mergeUnique(DEFAULT_RATING_SYSTEMS, metadata?.ratingSystem);
  const CERTIFICATION_TYPES = mergeUnique(DEFAULT_CERTIFICATION_TYPES, metadata?.certificationType);
  const ADDITIONAL_SERVICES = mergeUnique(DEFAULT_ADDITIONAL_SERVICES, metadata?.additionalServices);
  const BUILDING_USAGES = mergeUnique(DEFAULT_BUILDING_USAGES, metadata?.buildingUsages);
  const CLIENT_SECTORS = mergeUnique(DEFAULT_CLIENT_SECTORS, metadata?.clientSectors);

  useEffect(() => {
    if (project) {
      setForm({
        ...project,
        services: project.services || [],
        ratingSystem: project.ratingSystem || [],
        ratingSystemVersions: project.ratingSystemVersions || {},
        certificationType: project.certificationType || [],
        additionalServices: project.additionalServices || [],
        totalProposedMoney: project.totalProposedMoney || '',
        proposalMonth: toInputDate(project.proposalMonth),
        contactPoint: project.contactPoint || { name: '', designation: '', number: '', mailId: '' },
        servicesOther: '', ratingSystemOther: '', certificationTypeOther: '',
        additionalServicesOther: '', ratingSystemVersionsOther: '',
        buildingUsageOther: '', clientSectorOther: ''
      });
    }
  }, [project]);

  const toggleMulti = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      totalProposedMoney: Number(form.totalProposedMoney) || 0,
      proposalValue: Number(form.totalProposedMoney) || 0,
      proposalMonth: form.proposalMonth || null,
      financialMilestones: [],
      currentFinancialMilestone: null,
      currentTechnicalMilestone: null
    };

    if (form.servicesOther) data.services = [...data.services, form.servicesOther];
    if (form.ratingSystemOther) data.ratingSystem = [...data.ratingSystem, form.ratingSystemOther];
    if (form.certificationTypeOther) data.certificationType = [...data.certificationType, form.certificationTypeOther];
    if (form.additionalServicesOther) data.additionalServices = [...data.additionalServices, form.additionalServicesOther];
    if (form.buildingUsageOther) data.buildingUsage = form.buildingUsageOther;
    if (form.clientSectorOther) data.clientSector = form.clientSectorOther;
    const cleanVersions = {};
    for (const [key, val] of Object.entries(data.ratingSystemVersions || {})) {
      if (key.endsWith('_custom')) continue;
      if (val === 'other') {
        cleanVersions[key] = data.ratingSystemVersions[`${key}_custom`] || 'other';
      } else {
        cleanVersions[key] = val;
      }
    }
    data.ratingSystemVersions = cleanVersions;

    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="inline-fields">
        <div className="form-group">
          <label>Project ID</label>
          <input value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
            placeholder="PRJ-XXX-001" required disabled={!!project} />
        </div>
        <div className="form-group">
          <label>Project Name</label>
          <input value={form.projectName} onChange={e => setForm({ ...form, projectName: e.target.value })}
            placeholder="Project name" required />
        </div>
      </div>

      <div className="inline-fields">
        <div className="form-group">
          <label>Client Name</label>
          <input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })}
            placeholder="Client name" required />
        </div>
        <div className="form-group">
          <label>Client Sector</label>
          <select value={form.clientSectorOther ? 'Other' : form.clientSector}
            onChange={e => {
              if (e.target.value === 'Other') {
                setForm({ ...form, clientSector: '', clientSectorOther: 'Other' });
              } else {
                setForm({ ...form, clientSector: e.target.value, clientSectorOther: '' });
              }
            }}>
            <option value="">Select...</option>
            {CLIENT_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Other">Other</option>
          </select>
          {form.clientSectorOther && (
            <input type="text" value={form.clientSectorOther === 'Other' ? '' : form.clientSectorOther}
              onChange={e => setForm({ ...form, clientSectorOther: e.target.value })}
              placeholder="Specify client sector" style={{ marginTop: 8, width: '100%' }} />
          )}
        </div>
      </div>

      <div className="inline-fields">
        <div className="form-group">
          <label>Lead Office</label>
          <select value={form.leadOffice} onChange={e => setForm({ ...form, leadOffice: e.target.value })}>
            {LEAD_OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Vertical</label>
          <select value={form.vertical} onChange={e => setForm({ ...form, vertical: e.target.value })}>
            <option value="ESG">ESG</option>
            <option value="Green Building Certification">Green Building Certification</option>
            <option value="MEFP Design">MEFP Design</option>
          </select>
        </div>
      </div>

      <div className="inline-fields">
        <div className="form-group">
          <label>Project Location</label>
          <input value={form.projectLocation} onChange={e => setForm({ ...form, projectLocation: e.target.value })}
            placeholder="City / Region" />
        </div>
        <div className="form-group">
          <label>Project Area</label>
          <input value={form.projectArea} onChange={e => setForm({ ...form, projectArea: e.target.value })}
            placeholder="Project area or zone" />
        </div>
      </div>

      <div className="inline-fields">
        <div className="form-group">
          <label>Building Usage</label>
          <select value={form.buildingUsageOther ? 'Other' : form.buildingUsage}
            onChange={e => {
              if (e.target.value === 'Other') {
                setForm({ ...form, buildingUsage: '', buildingUsageOther: 'Other' });
              } else {
                setForm({ ...form, buildingUsage: e.target.value, buildingUsageOther: '' });
              }
            }}>
            <option value="">Select...</option>
            {BUILDING_USAGES.map(b => <option key={b} value={b}>{b}</option>)}
            <option value="Other">Other</option>
          </select>
          {form.buildingUsageOther && (
            <input type="text" value={form.buildingUsageOther === 'Other' ? '' : form.buildingUsageOther}
              onChange={e => setForm({ ...form, buildingUsageOther: e.target.value })}
              placeholder="Specify building usage" style={{ marginTop: 8, width: '100%' }} />
          )}
        </div>
        <div className="form-group">
          <label>Total Proposed Amount (INR)</label>
          <input type="number" value={form.totalProposedMoney}
            onChange={e => setForm({ ...form, totalProposedMoney: e.target.value })}
            placeholder="Amount" required />
        </div>
      </div>

      <div className="inline-fields">
        <div className="form-group">
          <label>Proposal Month</label>
          <input type="date" value={form.proposalMonth}
            onChange={e => setForm({ ...form, proposalMonth: e.target.value })} />
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16, background: 'var(--bg)' }}>
        <label style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 12, display: 'block' }}>Contact Point</label>
        <div className="inline-fields">
          <div className="form-group">
            <label>Name</label>
            <input value={form.contactPoint.name}
              onChange={e => setForm({ ...form, contactPoint: { ...form.contactPoint, name: e.target.value } })}
              placeholder="Contact person name" required />
          </div>
          <div className="form-group">
            <label>Designation</label>
            <input value={form.contactPoint.designation}
              onChange={e => setForm({ ...form, contactPoint: { ...form.contactPoint, designation: e.target.value } })}
              placeholder="Designation" required />
          </div>
        </div>
        <div className="inline-fields">
          <div className="form-group">
            <label>Phone Number</label>
            <input value={form.contactPoint.number}
              onChange={e => setForm({ ...form, contactPoint: { ...form.contactPoint, number: e.target.value } })}
              placeholder="+91-XXXXXXXXXX" required />
          </div>
          <div className="form-group">
            <label>Email ID</label>
            <input type="email" value={form.contactPoint.mailId}
              onChange={e => setForm({ ...form, contactPoint: { ...form.contactPoint, mailId: e.target.value } })}
              placeholder="email@company.com" required />
          </div>
        </div>
      </div>

      {/* Multi-select: Services */}
      <div className="form-group">
        <label>Service Lines</label>
        <div className="multi-select-chips">
          {SERVICES.map(s => (
            <button type="button" key={s}
              className={`chip ${form.services.includes(s) ? 'chip-active' : ''}`}
              onClick={() => toggleMulti('services', s)}>{s}</button>
          ))}
          <button type="button"
            className={`chip ${form.servicesOther ? 'chip-active' : ''}`}
            onClick={() => setForm({ ...form, servicesOther: form.servicesOther ? '' : 'Other' })}>
            Others
          </button>
        </div>
        {form.servicesOther && (
          <input type="text" value={form.servicesOther}
            onChange={e => setForm({ ...form, servicesOther: e.target.value })}
            placeholder="Specify other service" style={{ marginTop: 8, width: '100%' }} />
        )}
      </div>

      {/* Multi-select: Rating System */}
      <div className="form-group">
        <label>Rating System</label>
        <div className="multi-select-chips">
          {RATING_SYSTEMS.map(r => (
            <button type="button" key={r}
              className={`chip ${form.ratingSystem.includes(r) ? 'chip-active' : ''}`}
              onClick={() => toggleMulti('ratingSystem', r)}>{r}</button>
          ))}
          <button type="button"
            className={`chip ${form.ratingSystemOther ? 'chip-active' : ''}`}
            onClick={() => setForm({ ...form, ratingSystemOther: form.ratingSystemOther ? '' : 'Other' })}>
            Others
          </button>
        </div>
        {form.ratingSystemOther && (
          <input type="text" value={form.ratingSystemOther}
            onChange={e => setForm({ ...form, ratingSystemOther: e.target.value })}
            placeholder="Specify other rating system" style={{ marginTop: 8, width: '100%' }} />
        )}
      </div>

      {form.ratingSystem.length > 0 && (
        <div className="form-group">
          <label>Rating System Versions</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {form.ratingSystem.map(rs => (
              <div key={rs}>
                <select value={form.ratingSystemVersions[rs] || ''}
                  onChange={e => setForm({
                    ...form,
                    ratingSystemVersions: { ...form.ratingSystemVersions, [rs]: e.target.value }
                  })}>
                  <option value="">{rs} - Select version</option>
                  {(RATING_SYSTEM_VERSIONS[rs] || []).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
                {form.ratingSystemVersions[rs] === 'other' && (
                  <input type="text" placeholder={`Custom ${rs} version`}
                    value={form.ratingSystemVersions[`${rs}_custom`] || ''}
                    onChange={e => setForm({
                      ...form,
                      ratingSystemVersions: { ...form.ratingSystemVersions, [`${rs}_custom`]: e.target.value }
                    })}
                    style={{ marginTop: 6, width: '100%' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-select: Certification Type */}
      <div className="form-group">
        <label>Certification Type</label>
        <div className="multi-select-chips">
          {CERTIFICATION_TYPES.map(c => (
            <button type="button" key={c}
              className={`chip ${form.certificationType.includes(c) ? 'chip-active' : ''}`}
              onClick={() => toggleMulti('certificationType', c)}>{c}</button>
          ))}
          <button type="button"
            className={`chip ${form.certificationTypeOther ? 'chip-active' : ''}`}
            onClick={() => setForm({ ...form, certificationTypeOther: form.certificationTypeOther ? '' : 'Other' })}>
            Others
          </button>
        </div>
        {form.certificationTypeOther && (
          <input type="text" value={form.certificationTypeOther}
            onChange={e => setForm({ ...form, certificationTypeOther: e.target.value })}
            placeholder="Specify other certification type" style={{ marginTop: 8, width: '100%' }} />
        )}
      </div>

      {/* Multi-select: Additional Services */}
      <div className="form-group">
        <label>Additional Services</label>
        <div className="multi-select-chips">
          {ADDITIONAL_SERVICES.map(s => (
            <button type="button" key={s}
              className={`chip ${form.additionalServices.includes(s) ? 'chip-active' : ''}`}
              onClick={() => toggleMulti('additionalServices', s)}>{s}</button>
          ))}
          <button type="button"
            className={`chip ${form.additionalServicesOther ? 'chip-active' : ''}`}
            onClick={() => setForm({ ...form, additionalServicesOther: form.additionalServicesOther ? '' : 'Other' })}>
            Others
          </button>
        </div>
        {form.additionalServicesOther && (
          <input type="text" value={form.additionalServicesOther}
            onChange={e => setForm({ ...form, additionalServicesOther: e.target.value })}
            placeholder="Specify other additional service" style={{ marginTop: 8, width: '100%' }} />
        )}
      </div>

      <div className="modal-footer" style={{ padding: 0, border: 'none' }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-blue">
          {project ? 'Update Project' : 'Create Proposal'}
        </button>
      </div>
    </form>
  );
}
