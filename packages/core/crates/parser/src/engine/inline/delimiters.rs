// Pairing follows markdown-it 14.3.0; see THIRD_PARTY_NOTICES.md.
use super::token::{Delimiter, Token, TokenKind};
use crate::{ParseError, engine::Budget};

pub(super) fn balance(
    tokens: &mut [Token],
    ds: &mut [Delimiter],
    budget: &mut Budget,
) -> Result<(), ParseError> {
    pair_delimiters(ds, budget)?;
    mark_strong_pairs(tokens, ds, budget)
}

fn pair_delimiters(ds: &mut [Delimiter], budget: &mut Budget) -> Result<(), ParseError> {
    let mut lower_bounds = std::collections::HashMap::<(usize, u8), [isize; 6]>::new();
    let mut jumps = vec![0; ds.len()];
    let (mut header, mut previous_token) = (0, None);

    for closer_index in 0..ds.len() {
        budget.spend(1)?;

        if ds[header].key != ds[closer_index].key
            || previous_token != ds[closer_index].token.checked_sub(1)
        {
            header = closer_index;
        }

        previous_token = Some(ds[closer_index].token);

        if !ds[closer_index].close {
            continue;
        }

        let bottom = lower_bounds.entry(ds[closer_index].key).or_insert([-1; 6]);
        let parameter = usize::from(ds[closer_index].open) * 3 + ds[closer_index].length % 3;
        let minimum = bottom[parameter];
        let mut opener = header as isize - jumps[header] as isize - 1;
        let mut new_min = opener;

        while opener > minimum {
            budget.spend(1)?;

            let opener_index = opener as usize;
            let opening = ds[opener_index];
            let closing = ds[closer_index];

            let odd_match = (opening.close || closing.open)
                && (opening.length + closing.length).is_multiple_of(3)
                && (!opening.length.is_multiple_of(3) || !closing.length.is_multiple_of(3));

            if opening.key == closing.key && opening.open && opening.end.is_none() && !odd_match {
                let jump = if opener_index > 0 && !ds[opener_index - 1].open {
                    jumps[opener_index - 1] + 1
                } else {
                    0
                };

                jumps[closer_index] = closer_index - opener_index + jump;
                jumps[opener_index] = jump;

                ds[closer_index].open = false;
                ds[opener_index].end = Some(closer_index);
                ds[opener_index].close = false;

                new_min = -1;
                previous_token = None;

                break;
            }

            opener -= jumps[opener_index] as isize + 1;
        }

        if new_min != -1 {
            bottom[parameter] = new_min;
        }
    }

    Ok(())
}

fn mark_strong_pairs(
    tokens: &mut [Token],
    ds: &mut [Delimiter],
    budget: &mut Budget,
) -> Result<(), ParseError> {
    let mut i = ds.len();

    while i > 0 {
        budget.spend(1)?;
        i -= 1;

        let Some(end) = ds[i].end else {
            continue;
        };

        let strong = ds[i].pairing.combine_pairs
            && i > 0
            && end + 1 < ds.len()
            && ds[i - 1].end == Some(end + 1)
            && ds[i - 1].key == ds[i].key
            && ds[i - 1].token + 1 == ds[i].token
            && ds[end].token + 1 == ds[end + 1].token;

        let open_token = ds[i].token;
        let close_token = ds[end].token;

        tokens[open_token].kind = TokenKind::Open(ds[i].pairing.make, strong);
        tokens[close_token].kind = TokenKind::Close;

        if strong {
            tokens[open_token].start = tokens[ds[i - 1].token].start;
            tokens[close_token].end = tokens[ds[end + 1].token].end;
            tokens[ds[i - 1].token].kind = TokenKind::Empty;
            tokens[ds[end + 1].token].kind = TokenKind::Empty;
            i -= 1;
        }
    }

    Ok(())
}
