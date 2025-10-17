module.exports = async function paginate(Model, filter={}, { page=1, pageSize=20, sort={ createdAt: -1 }, select="" }={}){
  page = Math.max(+page || 1, 1);
  pageSize = Math.min(Math.max(+pageSize || 20, 1), 100);
  const [items, total] = await Promise.all([
    Model.find(filter).select(select).sort(sort).skip((page-1)*pageSize).limit(pageSize),
    Model.countDocuments(filter)
  ]);
  return { items, meta: { page, pageSize, total, pages: Math.ceil(total/pageSize) } };
};
