package io.hexlet.calendar;

import io.hexlet.calendar.api.MeetingsApi;
import io.hexlet.calendar.model.CreateMeeting;
import io.hexlet.calendar.model.Meeting;
import io.hexlet.calendar.model.MeetingType;
import io.hexlet.calendar.model.FieldError;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Email;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeetingsController implements MeetingsApi {
    // ECMAScript String.trim(): the topic policy shared with useBooking.ts.
    private static final String TOPIC_WHITESPACE =
            "\t\n\u000b\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007"
            + "\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
    private record EmailAddress(@Email String value) { }
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final CalendarController calendar;
    private final TransactionTemplate transaction;
    private final Validator validator;

    public MeetingsController(JdbcTemplate jdbc, Clock clock, CalendarController calendar,
            PlatformTransactionManager manager, Validator validator) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.calendar = calendar;
        this.validator = validator;
        transaction = new TransactionTemplate(manager);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Override
    public ResponseEntity<Meeting> createMeeting(CreateMeeting input) {
        var meeting = transaction.execute(status -> {
            jdbc.queryForObject("SELECT id FROM owner_calendar WHERE id = 1 FOR UPDATE", Integer.class);
            var now = clock.instant();
            var type = calendar.getMeetingType(input.getMeetingTypeId()).getBody();
            var start = input.getStartsAt().withOffsetSameInstant(ZoneOffset.UTC);
            var end = start.plusMinutes(type.getDurationMinutes());
            if (!start.toInstant().isAfter(now)) {
                throw new SlotException("SLOT_EXPIRED");
            }
            if (!BookingPolicy.valid(start.toInstant(), end.toInstant(), now)) {
                throw new SlotException("INVALID_SLOT");
            }
            var overlaps = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM meetings WHERE starts_at < ? AND ends_at > ?", Long.class, end, start);
            if (overlaps > 0) {
                throw new SlotException("SLOT_TAKEN");
            }
            var name = input.getGuestName() == null ? "" : input.getGuestName().strip();
            var email = input.getGuestEmail() == null ? "" : input.getGuestEmail().strip();
            var topic = trimTopic(input.getTopic());
            var errors = new ArrayList<FieldError>();
            if (topic.codePointCount(0, topic.length()) > 500) {
                errors.add(new FieldError().field("topic").message("Введите не более 500 символов"));
            }
            if (name.isEmpty() || name.codePointCount(0, name.length()) > 100) {
                errors.add(new FieldError().field("guestName").message("Введите от 1 до 100 символов"));
            }
            if (email.isEmpty() || email.length() > 254
                    || !validator.validate(new EmailAddress(email)).isEmpty()) {
                errors.add(new FieldError().field("guestEmail").message("Введите корректный email до 254 символов"));
            }
            if (!errors.isEmpty()) { throw new ApiValidationException(errors); }
            var saved = new Meeting().id(UUID.randomUUID()).meetingType(type).startsAt(start).endsAt(end)
                    .guestName(name).guestEmail(email).topic(topic.isEmpty() ? null : topic);
            jdbc.update("""
                    INSERT INTO meetings (id, meeting_type_id, starts_at, ends_at, guest_name, guest_email, topic)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, saved.getId(), type.getId(), start, end, saved.getGuestName(), saved.getGuestEmail(),
                    saved.getTopic());
            return saved;
        });
        return ResponseEntity.status(201).body(meeting);
    }

    private static String trimTopic(String value) {
        if (value == null) { return ""; }
        var start = 0;
        var end = value.length();
        while (start < end && TOPIC_WHITESPACE.indexOf(value.charAt(start)) >= 0) { start++; }
        while (end > start && TOPIC_WHITESPACE.indexOf(value.charAt(end - 1)) >= 0) { end--; }
        return value.substring(start, end);
    }

    @Override
    public ResponseEntity<List<Meeting>> listMeetings() {
        return ResponseEntity.ok(jdbc.query("""
                SELECT m.*, t.title, t.description, t.duration_minutes FROM meetings m
                JOIN meeting_types t ON t.id = m.meeting_type_id
                WHERE m.starts_at > ? ORDER BY m.starts_at, m.id
                """, (row, index) -> new Meeting().id(row.getObject("id", UUID.class))
                        .meetingType(new MeetingType().id(row.getObject("meeting_type_id", UUID.class))
                                .title(row.getString("title")).description(row.getString("description"))
                                .durationMinutes(row.getInt("duration_minutes")))
                        .startsAt(row.getObject("starts_at", OffsetDateTime.class).withOffsetSameInstant(ZoneOffset.UTC))
                        .endsAt(row.getObject("ends_at", OffsetDateTime.class).withOffsetSameInstant(ZoneOffset.UTC))
                        .guestName(row.getString("guest_name")).guestEmail(row.getString("guest_email"))
                        .topic(row.getString("topic")),
                clock.instant().atOffset(ZoneOffset.UTC)));
    }
}
