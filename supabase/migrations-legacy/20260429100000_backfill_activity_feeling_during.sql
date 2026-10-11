update activities
set feeling_during = case feeling
  when 1 then 'sad'
  when 2 then 'neutral'
  when 3 then 'smile'
  when 4 then 'happy'
  else feeling_during
end
where feeling is not null
  and feeling_during is null;
