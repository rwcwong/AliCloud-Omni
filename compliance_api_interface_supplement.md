# Omni OS 消防物联网平台 — Compliance 模块 API 接口补充定义

---

本文档为《omini_os_api_interface_v3.0.md》的补充草案，依据旧版 Compliance 页面实际使用的数据与操作整理。下列 Compliance、inspection、audit 接口均未在 v3.0 主文档中定义，需后端评审后实现；不代表接口当前已上线。

## 1. 全局规范与调用约定

### 1.1 基础网络与鉴权

* **API 版本前缀**：/api/v1
* **请求与响应格式**：application/json，UTF-8
* **鉴权**：除登录外均携带 Authorization: Bearer <access_token>
* **ID 类型**：本补充接口中的 report_id、schedule_id、inspection_id 使用 API 服务端主键；建议采用整数，以与 v3.0 管理接口的主键约定一致。
* **设备标识**：响应中的 device_id 使用 v3.0 所定义的设备物理编码（例如 HD-GF-01），不返回数据库外键。
* **日期时间**：带时区的 ISO 8601 字符串；period_start、period_end 为 YYYY-MM-DD。

### 1.2 数据权限

* 后端必须依据登录用户角色执行项目／站点数据范围隔离；不能仅依赖前端传入的 site_id、project_code 或 site_code。
* admin 可访问全平台；executive 限定所属项目；officer 限定所属项目及站点，沿用 v3.0 的角色范围约定。
* 请求超出用户数据范围时返回 403 Forbidden；资源不存在或对当前用户不可见时可统一返回 404 Not Found，避免暴露其他站点资源是否存在。

---

## 2. 合规报告 (Compliance Reports)

### 2.1 查询合规报告列表

* **路径**：GET /api/v1/compliance/reports
* **说明**：页面按选中的站点读取报告，并按创建时间倒序显示。报告列表需要包含 report_data，页面用其显示设备／告警／逾期数量并生成打印版报告。
* **Query 参数**：
  * site_id (integer, 必填)：站点主键；仅返回当前用户有权限访问的站点报告。
  * status (string, 可选)：draft、pending_review、approved、submitted。
  * report_type (string, 可选)：Cap.572、FSD-Quarterly、Annual-Audit。
  * page (integer, 可选，默认 1)：页码，从 1 开始。
  * page_size (integer, 可选，默认 20，最大 100)：每页条数。
* **响应示例 (200 OK)**：

~~~json
{
  "total": 2,
  "page": 1,
  "page_size": 20,
  "total_pages": 1,
  "items": [
    {
      "id": 108,
      "site_id": 1,
      "site_code": "APM",
      "site_name": "APM",
      "site_name_zh": "觀塘APM",
      "report_type": "Cap.572",
      "title": "Cap.572 Monthly — October 2026",
      "period_start": "2026-10-01",
      "period_end": "2026-10-31",
      "status": "draft",
      "report_data": {
        "generated_at": "2026-10-26T02:00:00Z",
        "site_name": "觀塘APM",
        "device_count": 320,
        "device_status_breakdown": {
          "Normal": 312,
          "Fault": 2,
          "Alarm": 1,
          "Offline": 5
        },
        "alarm_count": 4,
        "alarms_critical": 1,
        "alarms_resolved": 2,
        "inspections_total": 18,
        "inspections_overdue": 2,
        "inspections_due_soon": 3
      },
      "created_at": "2026-10-26T02:00:00Z",
      "updated_at": "2026-10-26T02:00:00Z"
    }
  ]
}
~~~

* **字段说明**：
  * report_data 是生成时的统计快照，不应在读取列表时用当前设备数据覆盖。
  * device_status_breakdown 的键使用 v3.0 状态字典中的 Normal、Fault、Alarm、Offline 名称，值为设备数；若后端仍存整数状态，应先按 v3.0 状态映射转换。
  * 页面显示的合规数由前端计算：inspections_total - inspections_overdue - inspections_due_soon。旧页面没有单独保存 inspections_compliant 字段。
  * 报告按 created_at 倒序排列。

### 2.2 生成合规报告

* **路径**：POST /api/v1/compliance/reports
* **说明**：服务端依据站点、报告类型及报告周期，从有效设备、告警和检查排程中计算数据快照并保存报告。report_data 应由服务端生成，不能接受前端提交的统计值作为权威数据。
* **请求体 (JSON)**：

~~~json
{
  "site_id": 1,
  "report_type": "Cap.572",
  "period_start": "2026-10-01",
  "period_end": "2026-10-31",
  "locale": "zh-TW"
}
~~~

* **字段说明**：
  * site_id (integer, 必填)：报告所属站点。
  * report_type (string, 必填)：Cap.572（月度）、FSD-Quarterly（季度）、Annual-Audit（年度）。
  * period_start、period_end (date, 必填)：报告统计周期。旧页面按当前月份、当前季度或当前年份计算，并由前端传入。
  * locale (string, 可选)：en、zh-CN、zh-TW；用于生成与旧页面一致的本地化标题。未提供时建议使用用户账号语言或 en。
* **服务端生成规则（与旧页面字段对应）**：
  * title：按报告类型、周期及 locale 生成；页面没有让用户编辑标题的输入项。
  * generated_at：报告实际生成时间。
  * site_name：按 locale 选取站点名称。
  * device_count：该站点下有效设备数；旧页面只统计 is_active=true 的设备。
  * device_status_breakdown：上述有效设备按状态分组计数。
  * alarm_count：报告周期内关联设备的告警数。
  * alarms_critical：严重告警数。具体哪个 v3.0 告警字段／枚举代表“严重”须按本文第 6 节确认。
  * alarms_resolved：已解决告警数。旧页面将 resolved 和 false_alarm 都计入；但 v3.0 当前只列出 active、acknowledged、dispatched、resolved，需按第 6 节处理枚举冲突。
  * inspections_total：关联有效设备的检查排程数量，不按报告周期截断。
  * inspections_overdue：生成时已过 next_due_at 的排程数。
  * inspections_due_soon：生成时未逾期且 30 天内到期的排程数。
  * 报告初始 status 为 draft。
* **响应示例 (201 Created)**：

~~~json
{
  "success": true,
  "item": {
    "id": 108,
    "site_id": 1,
    "site_code": "APM",
    "report_type": "Cap.572",
    "title": "Cap.572 月度 — 2026年10月",
    "period_start": "2026-10-01",
    "period_end": "2026-10-31",
    "status": "draft",
    "report_data": {
      "generated_at": "2026-10-26T02:00:00Z",
      "site_name": "觀塘APM",
      "device_count": 320,
      "device_status_breakdown": {
        "Normal": 312,
        "Fault": 2,
        "Alarm": 1,
        "Offline": 5
      },
      "alarm_count": 4,
      "alarms_critical": 1,
      "alarms_resolved": 2,
      "inspections_total": 18,
      "inspections_overdue": 2,
      "inspections_due_soon": 3
    },
    "created_at": "2026-10-26T02:00:00Z",
    "updated_at": "2026-10-26T02:00:00Z"
  }
}
~~~

### 2.3 提交报告审核

* **路径**：PATCH /api/v1/compliance/reports/{report_id}/status
* **路径参数**：
  * report_id (integer, 必填)：报告主键。
* **请求体 (JSON)**：

~~~json
{
  "status": "pending_review"
}
~~~

* **说明**：旧页面只允许对 draft 报告执行“提交审核”；当前页面没有批准、正式提交或撤回操作。后端应校验状态只能从 draft 转为 pending_review，避免前端通过此接口跳过审核流程。
* **响应示例 (200 OK)**：

~~~json
{
  "success": true,
  "report_id": 108,
  "status": "pending_review",
  "updated_at": "2026-10-26T02:10:00Z"
}
~~~

---

## 3. 检查排程与检查记录 (Inspections)

### 3.1 查询检查排程

* **路径**：GET /api/v1/compliance/inspection-schedules
* **说明**：页面一次读取当前用户可访问范围内的排程，按 next_due_at 升序展示；前端根据到期日计算逾期／即将到期／正常计数，支持 FSD 代码筛选和 Excel 导出。
* **Query 参数**：
  * project_code (string, 可选)：按项目过滤。
  * site_code (string, 可选)：按站点过滤。
  * fsd_code (string, 可选)：按 FSD 检查代码过滤。
  * due_status (string, 可选)：overdue、due-soon、ok；不传表示全部。
  * page (integer, 可选，默认 1)、page_size (integer, 可选，默认 100，最大 1000)：如启用分页，前端必须遍历所有页后再计算完整计数或导出完整筛选结果。
* **响应示例 (200 OK)**：

~~~json
{
  "total": 2,
  "page": 1,
  "page_size": 100,
  "total_pages": 1,
  "items": [
    {
      "id": 301,
      "device_id": "HD-GF-01",
      "device_label": "貨物起卸場溫感",
      "floor_name": "G/F",
      "fsd_code": "FSI-Q01",
      "schedule_type": "quarterly",
      "last_inspected_at": "2026-07-26T04:00:00Z",
      "next_due_at": "2026-10-26T04:00:00Z"
    },
    {
      "id": 302,
      "device_id": "HD-GF-02",
      "device_label": "走廊煙霧探測器",
      "floor_name": "G/F",
      "fsd_code": "FSI-Q01",
      "schedule_type": "quarterly",
      "last_inspected_at": null,
      "next_due_at": "2026-11-30T04:00:00Z"
    }
  ]
}
~~~

* **字段与页面计算说明**：
  * schedule_type：monthly、quarterly、6-monthly、annual。
  * last_inspected_at 可为空；next_due_at 必填。
  * 旧页面按 differenceInDays(next_due_at, 当前时间) 计算状态：小于 0 为 overdue，0 至 30 天为 due-soon，大于 30 天为 ok。该状态为展示计算值，不需要作为数据库字段存储。
  * 旧页面的 Excel 导出列为设备编码、设备名称、楼层、FSD 代码、排程类型、上次检查日期、下次到期日期、到期状态。

### 3.2 查询某排程的检查历史

* **路径**：GET /api/v1/compliance/inspection-schedules/{schedule_id}/inspections
* **路径参数**：
  * schedule_id (integer, 必填)：检查排程主键。
* **说明**：页面按检查日期倒序显示该排程全部检查记录。
* **响应示例 (200 OK)**：

~~~json
{
  "items": [
    {
      "id": 901,
      "inspection_schedule_id": 301,
      "device_id": "HD-GF-01",
      "inspector_name": "Alex Chan",
      "inspector_email": "alex@example.com",
      "inspection_date": "2026-10-26T04:00:00Z",
      "result": "pass",
      "certificate_ref": "CERT-2026-001",
      "remarks": "检查正常",
      "created_at": "2026-10-26T04:01:00Z"
    }
  ]
}
~~~

* **字段说明**：
  * result：pass、fail、conditional_pass。
  * 页面展示检查人、结果、日期、证书编号及备注；不需要返回其他设备遥测字段。

### 3.3 登记检查结果 (Sign Off)

* **路径**：POST /api/v1/compliance/inspection-schedules/{schedule_id}/inspections
* **路径参数**：
  * schedule_id (integer, 必填)：被完成检查的排程主键。
* **请求体 (JSON)**：

~~~json
{
  "inspector_name": "Alex Chan",
  "inspection_date": "2026-10-26T04:00:00Z",
  "result": "pass",
  "certificate_ref": "CERT-2026-001",
  "remarks": "检查正常"
}
~~~

* **字段说明**：
  * inspector_name (string, 必填)：页面可编辑；默认填入当前用户邮箱。
  * inspection_date (ISO 8601 datetime, 必填)：页面日期选择器选定的检查日期。旧页面将选定日的本地中午转换成 ISO 时间发送。
  * result (string, 必填)：pass、fail、conditional_pass。
  * certificate_ref、remarks (string, 可选)：无内容时为空字符串。
  * inspector_email、device_id 不由客户端指定；后端从登录身份和排程记录确定，防止伪造检查人或关联设备。
* **服务端处理**：
  1. 验证排程存在且在当前用户可访问的数据范围内。
  2. 创建检查记录，device_id 从排程读取，检查人邮箱从 Bearer Token 对应用户读取。
  3. 更新该排程的 last_inspected_at 与 next_due_at。
  4. 检查记录创建与排程更新必须在一个数据库事务内完成；任一步失败时整体回滚。
  5. 旧页面按固定天数重算下次到期时间：monthly=30、quarterly=90、6-monthly=180、annual=365 天，并从提交时的当前时间计算。若改为按检查日期或自然月／季度计算，属于业务规则变更，见第 6 节。
* **响应示例 (201 Created)**：

~~~json
{
  "success": true,
  "inspection": {
    "id": 901,
    "inspection_schedule_id": 301,
    "device_id": "HD-GF-01",
    "inspector_name": "Alex Chan",
    "inspector_email": "alex@example.com",
    "inspection_date": "2026-10-26T04:00:00Z",
    "result": "pass",
    "certificate_ref": "CERT-2026-001",
    "remarks": "检查正常",
    "created_at": "2026-10-26T04:01:00Z"
  },
  "schedule": {
    "id": 301,
    "last_inspected_at": "2026-10-26T04:00:00Z",
    "next_due_at": "2027-01-24T04:01:00Z"
  }
}
~~~

---

## 4. 审计记录 (Audit Trail)

### 4.1 查询最近审计记录

* **路径**：GET /api/v1/audit-logs
* **说明**：Compliance 页面的 Audit Trail 标签读取最新 60 条记录，并提供手动刷新。
* **Query 参数**：
  * limit (integer, 可选，默认 60，最大 100)：返回记录数。
  * project_code、site_code (string, 可选)：管理员可按项目／站点过滤；非管理员仍必须由服务端强制限制数据范围。
* **响应示例 (200 OK)**：

~~~json
{
  "items": [
    {
      "id": 7001,
      "actor_email": "admin@example.com",
      "action": "UPDATE",
      "table_name": "inspection_schedules",
      "record_label": "HD-GF-01",
      "created_at": "2026-10-26T04:01:00Z"
    }
  ]
}
~~~

* **字段说明**：
  * 按 created_at 倒序。
  * 页面只显示 actor_email、action、record_label、table_name、created_at；无 actor_email 时显示为 system。
  * 页面样式识别的常见 action 为 CREATE、UPDATE、DELETE、INVITE、ROLE_CHANGE、TOGGLE，其他值可原样显示。
  * 旧页面没有创建审计记录的客户端操作；建议后端在报告生成、提交审核、检查签署等写操作成功时服务端写入审计事件，不提供客户端任意插入审计记录的接口。
  * old_data、new_data、actor_id、record_id 虽存在于旧数据结构中，但当前页面不显示；默认不返回数据快照，避免向前端暴露不必要的敏感字段。
* **授权建议**：管理员可查询全平台记录；项目主管／站点值班员只可查询其权限范围内的记录。审计事件若无法可靠关联项目或站点，应仅向管理员返回。

---

## 5. 通用错误响应

错误格式沿用 v3.0 后端的 detail 风格：

~~~json
{
  "detail": "The selected report is not in a submittable state."
}
~~~

* 401 Unauthorized：Bearer Token 缺失、失效或过期。
* 403 Forbidden：无权执行该操作。
* 404 Not Found：目标记录不存在或不在当前用户可见范围内。
* 422 Unprocessable Entity：字段缺失、格式错误或枚举值不合法。
* 409 Conflict：状态流转冲突，例如对非 draft 报告再次提交审核。

---

## 6. 与旧页面及 v3.0 的差异／待后端确认项

1. **页面来源**：当前工作树中的 src/panels/CompliancePanel.tsx 已是 ApiUnavailable 占位组件。完整旧版位于同级 OmniOS-main 与 OmniOS-main-1008 项目，两份 CompliancePanel.tsx 内容一致。本补充文档基于这两份旧实现整理。
2. **告警统计周期**：旧代码只筛选 triggered_at >= period_start，没有限制 period_end，因此周期结束后的告警也可能被计入。本文接口建议按 [period_start 00:00, period_end 次日 00:00) 做周期范围统计；这是对旧逻辑的修正，请后端确认是否采用。
3. **严重告警枚举**：旧代码按 severity === "critical" 计算 alarms_critical；v3.0 告警示例的 severity 使用 "Alarm"，尚未定义二者映射。需要后端明确严重告警的来源字段和值，避免统计失真。
4. **误报枚举**：旧代码把 false_alarm 计入已解决；v3.0 的告警状态目前未定义 false_alarm。本文建议先按 v3.0 已有的 resolved 统计，只有后端确认并正式增加 false_alarm 状态后再纳入。
5. **检查周期计算**：旧代码按固定 30／90／180／365 天，从提交时刻计算 next_due_at；按选定的检查日期或自然月计算会产生不同结果。请后端确认是否保持旧行为。
6. **Cap.572 清单与 PDF**：旧页面用浏览器临时打开 HTML 打印页。清单的 Pass／Fail／N/A 和备注输入只存在于该打印页中，不会提交或保存；当前页面也不使用 pdf_url。因此本接口未定义清单答题保存、PDF 上传或 PDF URL 接口。若需要持久化清单结果，应另行定义清单模板、答案结构及 PDF 存储需求。
7. **排程数据量**：旧页面一次读取当前授权范围内的排程并在前端筛选、计数及导出。本文列出可选分页参数；若启用分页，前端须遍历所有页后再完成全量计数和导出，否则应暂时返回完整授权结果。
8. **有效设备定义**：旧页面用 devices.is_active=true 筛选报告统计设备；v3.0 设备接口尚未定义 is_active 字段。后端需要确认报告应按该数据库字段筛选，或定义等价的“有效设备”规则，不能直接将在线状态当作有效状态。
9. **周期日期与时区**：旧代码按本地日历生成周期边界后调用 toISOString() 截取日期；在 UTC+时区可能造成日期向前偏移一天。建议 API 以 YYYY-MM-DD 处理日历日期，并由前端以纯日期方式传入；接入前需修正或确认现有日期序列化规则。
10. **旧页面没有的操作**：未定义创建／编辑／删除检查排程、审批报告、正式提交报告或导出服务器端 PDF 的接口；这些操作在旧 Compliance 页面中没有对应操作入口。

---
